'use client';

/** Coquille de la boîte de réception : liste + temps réel + notifications. */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { BotOrb } from '@/components/widget/parts';
import { cn, timeAgo } from '@/lib/utils';
import type { Agent, ConversationStatus, Notification as AppNotification } from '@/lib/types';
import { Avatar, StatusBadge, UnreadBadge } from './parts';
import { CannedPanel } from './canned-panel';
import {
  getNotificationPermission,
  notificationSupported,
  playNotificationSound,
  requestNotificationPermission,
  showBrowserNotification
} from '@/lib/browser-notify';

export interface InboxItem {
  id: string;
  status: ConversationStatus;
  visitor_id: string;
  visitor_name: string | null;
  assigned_agent_id: string | null;
  assigned_name: string | null;
  unread_count: number;
  escalated_at: string | null;
  updated_at: string;
  last_message: { sender: string; content: string; created_at: string } | null;
}

export function InboxShell({
  agent,
  selectedId,
  children
}: {
  agent: Agent;
  selectedId: string | null;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [cannedOpen, setCannedOpen] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | null>(null);
  /**
   * Le temps réel a-t-il été refusé ? Les canaux sont privés (migration 0010) :
   * si les policies de `realtime.messages` ne sont pas encore en place, ou si le
   * jeton de session est expiré, l'abonnement échoue. Sans repli, l'agent aurait
   * une boîte de réception silencieuse et figée — le pire des deux mondes, car
   * rien ne le lui signalerait. On bascule alors sur un rafraîchissement
   * périodique, et on le dit.
   */
  const [realtimeDown, setRealtimeDown] = useState(false);

  useEffect(() => {
    setBrowserPermission(getNotificationPermission());
  }, []);

  async function enableBrowserNotifications() {
    const perm = await requestNotificationPermission();
    setBrowserPermission(perm);
  }

  const load = useCallback(async (resolved: boolean) => {
    const res = await fetch(`/api/agent/inbox${resolved ? '?resolved=1' : ''}`, { cache: 'no-store' });
    if (res.ok) {
      const j = await res.json();
      setItems(j.conversations ?? []);
    }
    setLoading(false);
  }, []);

  const loadNotifs = useCallback(async () => {
    const res = await fetch('/api/agent/notifications', { cache: 'no-store' });
    if (res.ok) {
      const j = await res.json();
      setNotifs(j.notifications ?? []);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load(tab === 'resolved');
  }, [tab, load]);

  useEffect(() => {
    loadNotifs();
  }, [loadNotifs]);

  // Temps réel : mises à jour de la boîte + notifications personnelles.
  // Canaux PRIVÉS : l'abonnement est vérifié contre les policies de
  // `realtime.messages` (migration 0010). Le JWT de session de l'agent est
  // présenté explicitement à Realtime avant l'abonnement.
  useEffect(() => {
    let inbox: ReturnType<typeof supabase.channel> | null = null;
    let perso: ReturnType<typeof supabase.channel> | null = null;
    let disposed = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken || disposed) return;
      await supabase.realtime.setAuth(accessToken);
      if (disposed) return;

      // Un refus d'abonnement bascule en mode dégradé. `SUBSCRIBED` le lève,
      // pour qu'une coupure réseau passagère se rétablisse d'elle-même.
      const onStatus = (status: string) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeDown(true);
        else if (status === 'SUBSCRIBED') setRealtimeDown(false);
      };

      inbox = supabase.channel('inbox:all', { config: { private: true } });
      inbox.on('broadcast', { event: 'inbox:update' }, () => load(tab === 'resolved')).subscribe(onStatus);

      perso = supabase.channel(`agent:${agent.id}`, { config: { private: true } });
      perso
        .on('broadcast', { event: 'notification:new' }, ({ payload }: { payload: AppNotification }) => {
          setNotifs((n) => [payload, ...n.filter((x) => x.id !== payload.id)]);
          const alreadyOnConversation = Boolean(payload.conversation_id) && payload.conversation_id === selectedId;
          if (alreadyOnConversation && document.hasFocus()) return;
          playNotificationSound();
          showBrowserNotification({
            title: payload.title,
            body: payload.body,
            onClick: () => {
              if (payload.conversation_id) router.push(`/inbox/${payload.conversation_id}`);
            }
          });
        })
        .subscribe(onStatus);
    })();

    return () => {
      disposed = true;
      if (inbox) supabase.removeChannel(inbox);
      if (perso) supabase.removeChannel(perso);
    };
  }, [supabase, agent.id, tab, load, selectedId, router]);

  // Repli : sans temps réel, on rafraîchit la liste et les notifications
  // périodiquement. Mieux vaut un délai de 15 s qu'une boîte figée.
  useEffect(() => {
    if (!realtimeDown) return;
    const id = setInterval(() => {
      load(tab === 'resolved');
      loadNotifs();
    }, 15000);
    return () => clearInterval(id);
  }, [realtimeDown, load, loadNotifs, tab]);

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  async function markAllRead() {
    setNotifs([]);
    await fetch('/api/agent/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
  }

  async function openNotification(n: AppNotification) {
    if (n.conversation_id) router.push(`/inbox/${n.conversation_id}`);
    setNotifOpen(false);
    await fetch('/api/agent/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: n.id })
    });
    setNotifs((list) => list.filter((x) => x.id !== n.id));
  }

  return (
    // `100dvh` et non `h-screen` : sur mobile, `vh` inclut la barre d'adresse
    // rétractable, ce qui poussait le composeur hors de l'écran.
    <div className="flex h-[100dvh] overflow-hidden bg-mist">
      {/* Colonne liste — plein écran sur mobile, colonne fixe à partir de md.
          Sous md, liste et conversation ne coexistent pas : la route
          /inbox/[id] existant déjà, la navigation entre les deux est native
          (et le retour navigateur fonctionne). */}
      <aside
        className={cn(
          'flex w-full min-w-0 shrink-0 flex-col border-r border-mist-300 bg-white md:w-[360px]',
          selectedId && 'hidden md:flex'
        )}
      >
        <header className="flex items-center justify-between border-b border-mist-300 px-4 py-3">
          <Link href="/inbox" className="flex items-center gap-2">
            <BotOrb size={26} glow={false} />
            <span className="font-display text-base font-semibold tracking-tight">Luminae</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCannedOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-500 transition hover:bg-mist"
              title="Réponses rapides"
              aria-label="Réponses rapides"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <line x1="7" y1="9" x2="15" y2="9" />
                <line x1="7" y1="13" x2="12" y2="13" />
              </svg>
            </button>
            {agent.role === 'admin' && (
              <Link
                href="/admin"
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-500 transition hover:bg-mist"
                title="Administration"
                aria-label="Administration"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </Link>
            )}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="relative flex h-8 w-8 items-center justify-center rounded-full text-ink-500 transition hover:bg-mist"
                title="Notifications"
                aria-label="Notifications"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                {notifs.length > 0 && (
                  <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-coral ring-2 ring-white" />
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-10 z-30 w-80 rounded-xl border border-mist-300 bg-white p-2 shadow-panel">
                  <div className="flex items-center justify-between px-2 pb-1 pt-1">
                    <span className="text-sm font-semibold">Notifications</span>
                    {notifs.length > 0 && (
                      <button onClick={markAllRead} className="text-xs font-medium text-lagoon-600 hover:underline">
                        Tout marquer lu
                      </button>
                    )}
                  </div>
                  {notificationSupported() && browserPermission === 'default' && (
                    <button
                      onClick={enableBrowserNotifications}
                      className="mb-1 w-full rounded-lg bg-lagoon-50 px-2 py-1.5 text-left text-xs font-medium text-lagoon-700 transition hover:bg-lagoon-100"
                    >
                      🔔 Activer les notifications du navigateur
                    </button>
                  )}
                  {notificationSupported() && browserPermission === 'denied' && (
                    <p className="mb-1 px-2 py-1.5 text-[11px] text-ink-400">
                      Notifications du navigateur bloquées — à réactiver dans les réglages du site.
                    </p>
                  )}
                  {notifs.length === 0 ? (
                    <p className="px-2 py-4 text-center text-sm text-ink-400">Aucune notification.</p>
                  ) : (
                    <ul className="max-h-72 overflow-y-auto">
                      {notifs.map((n) => (
                        <li key={n.id}>
                          <button
                            onClick={() => openNotification(n)}
                            className="w-full rounded-lg px-2 py-2 text-left transition hover:bg-mist"
                          >
                            <p className="text-sm font-medium leading-snug">{n.title}</p>
                            {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{n.body}</p>}
                            <p className="mt-0.5 text-[11px] text-ink-400">{timeAgo(n.created_at)}</p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <Avatar name={agent.full_name ?? agent.email} url={agent.avatar_url} size={30} />
            <button
              onClick={logout}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-500 transition hover:bg-coral-100 hover:text-coral-600"
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Mode dégradé : l'agent doit savoir que sa liste n'est plus vivante,
            sinon il fait confiance à un affichage qui ne bouge plus. */}
        {realtimeDown && (
          <p
            role="status"
            className="border-b border-sun-300 bg-sun-50 px-4 py-2 text-[12px] font-medium text-sun-600"
          >
            Temps réel indisponible — actualisation toutes les 15 s.
          </p>
        )}

        {/* Onglets */}
        <div className="flex gap-1 px-4 pt-3">
          {(
            [
              ['open', 'En cours'],
              ['resolved', 'Résolues']
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition',
                tab === key ? 'bg-ink text-white' : 'text-ink-500 hover:bg-mist'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Liste des conversations */}
        <ul className="mt-2 flex-1 overflow-y-auto">
          {loading && <li className="px-4 py-6 text-center text-sm text-ink-400">Chargement…</li>}
          {!loading && items.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-ink-400">
              {tab === 'open' ? 'Aucune conversation en cours. 🎉' : 'Aucune conversation résolue.'}
            </li>
          )}
          {items.map((it) => (
            <li key={it.id}>
              <button
                onClick={() => router.push(`/inbox/${it.id}`)}
                className={cn(
                  'w-full border-b border-mist-300/60 px-4 py-3 text-left transition hover:bg-mist-50',
                  selectedId === it.id && 'bg-lagoon-50 hover:bg-lagoon-50'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{it.visitor_name ?? 'Visiteur'}</span>
                  <span className="shrink-0 text-[11px] text-ink-400">{timeAgo(it.updated_at)}</span>
                </div>
                {it.last_message && (
                  <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-500">
                    {it.last_message.sender === 'agent' ? 'Vous : ' : ''}
                    {it.last_message.content}
                  </p>
                )}
                <div className="mt-1.5 flex items-center gap-1.5">
                  <StatusBadge status={it.status} />
                  {it.assigned_name && (
                    <span className="truncate rounded-full bg-mist px-2 py-0.5 text-[11px] text-ink-500">
                      {it.assigned_name}
                    </span>
                  )}
                  <span className="flex-1" />
                  <UnreadBadge count={it.unread_count} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Zone principale — masquée sous md quand aucune conversation n'est
          sélectionnée : l'invitation « Sélectionnez une conversation » n'a pas
          de sens quand la liste occupe déjà tout l'écran. */}
      <main className={cn('flex min-w-0 flex-1 flex-col', !selectedId && 'hidden md:flex')}>
        {children ?? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <BotOrb size={54} glow />
            <div>
              <p className="font-display text-lg font-semibold">Sélectionnez une conversation</p>
              <p className="mt-1 text-sm text-ink-500">
                Les nouvelles demandes escaladées apparaissent ici en temps réel.
              </p>
            </div>
          </div>
        )}
      </main>

      {cannedOpen && <CannedPanel agent={agent} variant="modal" onClose={() => setCannedOpen(false)} />}
    </div>
  );
}