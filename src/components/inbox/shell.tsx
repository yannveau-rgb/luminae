'use client';

/** Coquille de la boîte de réception : liste intelligente + filtres + temps réel + raccourcis. */

import { useCallback, useEffect, useMemo, useState } from 'react';
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

type FilterSegment = 'all' | 'mine' | 'waiting' | 'bot' | 'resolved';

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
  const [segment, setSegment] = useState<FilterSegment>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [cannedOpen, setCannedOpen] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | null>(null);
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

  // Temps réel : mises à jour de la boîte + notifications personnelles
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

  // Repli périodique sans Realtime
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
  }

  // Filtrage intelligent en mémoire
  const filteredItems = useMemo(() => {
    let list = items;

    // Filtre par segment
    if (tab === 'open') {
      if (segment === 'mine') {
        list = list.filter((i) => i.assigned_agent_id === agent.id);
      } else if (segment === 'waiting') {
        list = list.filter((i) => i.status === 'waiting');
      } else if (segment === 'bot') {
        list = list.filter((i) => i.status === 'bot');
      }
    }

    // Filtre de recherche textuelle
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((i) => {
        const name = (i.visitor_name ?? '').toLowerCase();
        const msg = (i.last_message?.content ?? '').toLowerCase();
        const assigned = (i.assigned_name ?? '').toLowerCase();
        return name.includes(q) || msg.includes(q) || assigned.includes(q);
      });
    }

    return list;
  }, [items, tab, segment, searchQuery, agent.id]);

  // Compteurs pour chaque segment
  const counts = useMemo(() => {
    return {
      all: items.length,
      mine: items.filter((i) => i.assigned_agent_id === agent.id).length,
      waiting: items.filter((i) => i.status === 'waiting').length,
      bot: items.filter((i) => i.status === 'bot').length
    };
  }, [items, agent.id]);

  // Raccourcis clavier (j/k et flèches pour changer de conversation)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (filteredItems.length === 0) return;

      const currentIndex = filteredItems.findIndex((i) => i.id === selectedId);

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = currentIndex < filteredItems.length - 1 ? currentIndex + 1 : 0;
        router.push(`/inbox/${filteredItems[nextIndex].id}`);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredItems.length - 1;
        router.push(`/inbox/${filteredItems[prevIndex].id}`);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredItems, selectedId, router]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-mist">
      {/* ── Barre Latérale : Liste des conversations ───────────────────────── */}
      <aside
        className={cn(
          'flex w-full shrink-0 flex-col border-r border-mist-300 bg-white md:w-[350px] lg:w-[380px]',
          selectedId ? 'hidden md:flex' : 'flex'
        )}
      >
        {/* En-tête principal */}
        <header className="flex items-center justify-between border-b border-mist-300/80 px-4 py-3 bg-white/80 backdrop-blur-md">
          <Link href="/inbox" className="flex items-center gap-2.5" title="Boîte de réception Luminae">
            <BotOrb size={28} glow={false} />
            <div className="flex flex-col">
              <span className="font-display text-base font-bold tracking-tight text-ink">Luminae</span>
              <span className="text-[10px] font-medium text-lagoon-700">Inbox Agent</span>
            </div>
          </Link>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCannedOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-500 transition hover:bg-mist hover:text-ink"
              title="Réponses rapides (⚡)"
              aria-label="Réponses rapides"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </button>

            {agent.role === 'admin' && (
              <Link
                href="/admin"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-500 transition hover:bg-mist hover:text-ink"
                title="Cockpit Administration"
                aria-label="Administration"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.01a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              </Link>
            )}

            {/* Centre de notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="relative flex h-8 w-8 items-center justify-center rounded-xl text-ink-500 transition hover:bg-mist hover:text-ink"
                title="Notifications"
                aria-label="Notifications"
                aria-expanded={notifOpen}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 01-3.4 0" />
                </svg>
                {notifs.length > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-coral-500 ring-2 ring-white" />
                )}
              </button>

              {notifOpen && (
                <div
                  role="dialog"
                  aria-label="Centre de notifications"
                  className="absolute right-0 top-10 z-30 w-80 animate-slide-up rounded-2xl border border-mist-300 bg-white p-3 shadow-panel"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-mist-300/60">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink">Notifications</span>
                    {notifs.length > 0 && (
                      <button onClick={markAllRead} className="text-xs font-semibold text-lagoon-600 hover:underline">
                        Tout marquer lu
                      </button>
                    )}
                  </div>
                  {notificationSupported() && browserPermission === 'default' && (
                    <button
                      onClick={enableBrowserNotifications}
                      className="mt-2 w-full rounded-xl bg-lagoon-50 px-3 py-2 text-left text-xs font-medium text-lagoon-700 transition hover:bg-lagoon-100"
                    >
                      🔔 Activer les notifications du navigateur
                    </button>
                  )}
                  {notifs.length === 0 ? (
                    <p className="py-6 text-center text-xs text-ink-400">Aucune notification.</p>
                  ) : (
                    <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                      {notifs.map((n) => (
                        <li key={n.id}>
                          <button
                            onClick={() => openNotification(n)}
                            className="w-full rounded-xl p-2 text-left transition hover:bg-mist-100"
                          >
                            <p className="text-xs font-semibold text-ink">{n.title}</p>
                            {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{n.body}</p>}
                            <p className="mt-1 text-[10px] text-ink-400">{timeAgo(n.created_at)}</p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <Avatar name={agent.full_name ?? agent.email} url={agent.avatar_url} size={28} />

            <button
              onClick={logout}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-500 transition hover:bg-coral-50 hover:text-coral-600"
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Mode dégradé Realtime */}
        {realtimeDown && (
          <p
            role="status"
            className="border-b border-sun-300 bg-sun-50 px-4 py-2 text-xs font-medium text-sun-600"
          >
            Temps réel indisponible — actualisation toutes les 15 s.
          </p>
        )}

        {/* Barre de recherche instantanée */}
        <div className="p-3 border-b border-mist-300/60 bg-white">
          <div className="relative flex items-center">
            <svg
              className="absolute left-3 h-4 w-4 text-ink-400 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher (nom, message)…"
              className="w-full rounded-xl border border-mist-300 bg-mist-50 pl-9 pr-8 py-2 text-xs text-ink outline-none transition focus:border-lagoon-400 focus:bg-white focus:ring-2 focus:ring-lagoon-400/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-ink-400 hover:text-ink text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Bascule En cours / Résolues */}
        <div className="flex border-b border-mist-300/60 bg-mist-50 p-1.5 gap-1 text-xs">
          <button
            onClick={() => {
              setTab('open');
              setSegment('all');
            }}
            className={cn(
              'flex-1 rounded-lg py-1.5 font-medium transition text-center',
              tab === 'open' ? 'bg-white text-ink shadow-sm' : 'text-ink-500 hover:text-ink'
            )}
          >
            En cours
          </button>
          <button
            onClick={() => {
              setTab('resolved');
              setSegment('resolved');
            }}
            className={cn(
              'flex-1 rounded-lg py-1.5 font-medium transition text-center',
              tab === 'resolved' ? 'bg-white text-ink shadow-sm' : 'text-ink-500 hover:text-ink'
            )}
          >
            Résolues
          </button>
        </div>

        {/* Segments rapides (uniquement pour les conversations ouvertes) */}
        {tab === 'open' && (
          <div className="flex gap-1 overflow-x-auto px-3 py-2 border-b border-mist-300/60 bg-white text-[11px]">
            <button
              onClick={() => setSegment('all')}
              className={cn(
                'flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium transition shrink-0',
                segment === 'all' ? 'bg-ink text-white' : 'text-ink-500 hover:bg-mist'
              )}
            >
              <span>Tous</span>
              <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[9.5px]">{counts.all}</span>
            </button>

            <button
              onClick={() => setSegment('mine')}
              className={cn(
                'flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium transition shrink-0',
                segment === 'mine' ? 'bg-lagoon-600 text-white' : 'text-ink-500 hover:bg-mist'
              )}
            >
              <span>À moi</span>
              <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[9.5px]">{counts.mine}</span>
            </button>

            <button
              onClick={() => setSegment('waiting')}
              className={cn(
                'flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium transition shrink-0',
                segment === 'waiting' ? 'bg-sun-600 text-white' : 'text-ink-500 hover:bg-mist'
              )}
            >
              <span>En attente</span>
              {counts.waiting > 0 && (
                <span className="rounded-full bg-sun-500 px-1.5 py-0.2 text-[9.5px] text-white animate-pulse">
                  {counts.waiting}
                </span>
              )}
            </button>

            <button
              onClick={() => setSegment('bot')}
              className={cn(
                'flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium transition shrink-0',
                segment === 'bot' ? 'bg-aurora-600 text-white' : 'text-ink-500 hover:bg-mist'
              )}
            >
              <span>Bot</span>
              <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[9.5px]">{counts.bot}</span>
            </button>
          </div>
        )}

        {/* Liste des conversations avec cartes enrichies */}
        <ul className="flex-1 overflow-y-auto divide-y divide-mist-300/40">
          {loading && (
            <li className="space-y-3 p-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="flex animate-pulse items-center gap-3 rounded-2xl bg-mist-100 p-3">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-mist-300" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-28 rounded bg-mist-300" />
                    <div className="h-3 w-44 rounded bg-mist-200" />
                  </div>
                </div>
              ))}
            </li>
          )}

          {!loading && filteredItems.length === 0 && (
            <li className="p-8 text-center text-xs text-ink-400">
              {searchQuery
                ? 'Aucune conversation ne correspond à votre recherche.'
                : tab === 'open'
                  ? 'Aucune conversation dans cette vue. 🎉'
                  : 'Aucune conversation résolue.'}
            </li>
          )}

          {filteredItems.map((it) => {
            const isSelected = selectedId === it.id;
            return (
              <li key={it.id}>
                <button
                  onClick={() => router.push(`/inbox/${it.id}`)}
                  className={cn(
                    'group relative w-full p-3.5 text-left transition-all',
                    isSelected ? 'bg-lagoon-50/80' : 'hover:bg-mist-50 bg-white'
                  )}
                >
                  {/* Liseré indicateur d'état à gauche */}
                  <span
                    className={cn(
                      'absolute left-0 top-0 bottom-0 w-1 transition-all',
                      isSelected && 'w-1.5 bg-lagoon-600',
                      !isSelected && it.status === 'waiting' && 'bg-sun-500',
                      !isSelected && it.status === 'bot' && 'bg-aurora-400',
                      !isSelected && it.status === 'assigned' && 'bg-lagoon-400',
                      !isSelected && it.status === 'resolved' && 'bg-transparent'
                    )}
                  />

                  <div className="flex items-start gap-3">
                    <Avatar name={it.visitor_name ?? 'Visiteur'} size={34} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="truncate text-xs font-bold text-ink">
                          {it.visitor_name ?? 'Visiteur'}
                        </span>
                        <span className="shrink-0 text-[10.5px] font-medium text-ink-400">
                          {timeAgo(it.updated_at)}
                        </span>
                      </div>

                      {it.last_message && (
                        <p className="mt-1 line-clamp-1 text-xs text-ink-600 leading-snug">
                          <span className="font-medium text-ink-500">
                            {it.last_message.sender === 'agent'
                              ? 'Vous : '
                              : it.last_message.sender === 'bot'
                                ? 'Bot : '
                                : ''}
                          </span>
                          {it.last_message.content}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-1.5">
                        <StatusBadge status={it.status} />

                        {it.assigned_name && (
                          <span className="truncate rounded-md bg-mist-200/80 px-1.5 py-0.5 text-[10px] font-medium text-ink-600">
                            👤 {it.assigned_name}
                          </span>
                        )}

                        <span className="flex-1" />
                        <UnreadBadge count={it.unread_count} />
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ── Zone de Conversation Principale ──────────────────────────────────── */}
      <main className={cn('flex min-w-0 flex-1 flex-col', !selectedId && 'hidden md:flex')}>
        {children ?? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <BotOrb size={56} glow />
            <div>
              <p className="font-display text-lg font-bold text-ink">Sélectionnez une conversation</p>
              <p className="mt-1 text-xs text-ink-500 max-w-sm leading-relaxed">
                Utilisez les touches <kbd className="rounded border border-mist-300 bg-white px-1.5 py-0.5 text-[11px] font-mono shadow-2xs">J</kbd> et <kbd className="rounded border border-mist-300 bg-white px-1.5 py-0.5 text-[11px] font-mono shadow-2xs">K</kbd> pour naviguer rapidement.
              </p>
            </div>
          </div>
        )}
      </main>

      {cannedOpen && <CannedPanel agent={agent} variant="modal" onClose={() => setCannedOpen(false)} />}
    </div>
  );
}