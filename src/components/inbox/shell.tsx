'use client';

/** Coquille unifiée Luminae : Navigation permanente à gauche (Rail / Développé / Mobile Drawer) + Conversations + Paramétrages. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { BotOrb } from '@/components/widget/parts';
import { cn, timeAgo } from '@/lib/utils';
import type { Agent, ConversationStatus, Notification as AppNotification } from '@/lib/types';
import { Avatar, StatusBadge, UnreadBadge } from './parts';
import { CannedPanel } from './canned-panel';
import { TAB_CATEGORIES } from '@/components/admin/shell';
import { StatsPanel } from '@/components/admin/stats';
import { WorkflowsPanel } from '@/components/admin/workflows';
import { BotSettingsForm } from '@/components/admin/bot-settings';
import { ArticlesPanel } from '@/components/admin/articles';
import { PrechatPanel } from '@/components/admin/prechat';
import { TriggersPanel } from '@/components/admin/triggers';
import { IntegrationsPanel } from '@/components/admin/integrations';
import { RoutingPanel } from '@/components/admin/routing';
import { BusinessHoursForm } from '@/components/admin/business-hours';
import { AbsencesPanel } from '@/components/admin/absences';
import { TeamPanel } from '@/components/admin/team';
import { SecurityPanel } from '@/components/admin/security';
import { WebhooksPanel } from '@/components/admin/webhooks';
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

const ALL_ADMIN_KEYS = TAB_CATEGORIES.flatMap((c) => c.items.map((i) => i.key));

export function InboxShell({
  agent,
  selectedId,
  initialView = 'inbox',
  children
}: {
  agent: Agent;
  selectedId: string | null;
  initialView?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = supabaseBrowser();

  const queryTab = searchParams?.get('tab') || searchParams?.get('view');
  const [currentView, setCurrentView] = useState<string>(
    queryTab && ALL_ADMIN_KEYS.includes(queryTab) ? queryTab : initialView
  );
  const [railCollapsed, setRailCollapsed] = useState<boolean>(true);
  const [railHovered, setRailHovered] = useState<boolean>(false);
  const isExpanded = !railCollapsed || railHovered;
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [segment, setSegment] = useState<FilterSegment>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [cannedOpen, setCannedOpen] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | null>(null);

  // Multi-sélection et actions groupées (résolution par lot)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);

  useEffect(() => {
    setSelectedIds([]);
  }, [tab, segment]);

  useEffect(() => {
    if (queryTab && ALL_ADMIN_KEYS.includes(queryTab)) {
      setCurrentView(queryTab);
    }
  }, [queryTab]);

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

      inbox = supabase.channel('inbox:all');
      inbox.on('broadcast', { event: 'inbox:update' }, () => load(tab === 'resolved')).subscribe();

      perso = supabase.channel(`agent:${agent.id}`);
      perso
        .on('broadcast', { event: 'notification:new' }, ({ payload }: { payload: AppNotification }) => {
          setNotifs((n) => [payload, ...n.filter((x) => x.id !== payload.id)]);
          playNotificationSound();
          showBrowserNotification({
            title: payload.title,
            body: payload.body,
            onClick: () => {
              if (payload.conversation_id) {
                setCurrentView('inbox');
                router.push(`/inbox/${payload.conversation_id}`);
              }
            }
          });
        })
        .subscribe();
    })();

    return () => {
      disposed = true;
      if (inbox) supabase.removeChannel(inbox);
      if (perso) supabase.removeChannel(perso);
    };
  }, [supabase, agent.id, tab, load, selectedId, router]);

  // Synchronisation continue réactive : actualise la boîte et les notifications
  useEffect(() => {
    const id = setInterval(() => {
      load(tab === 'resolved');
      loadNotifs();
    }, 4500);
    return () => clearInterval(id);
  }, [load, loadNotifs, tab]);

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
    if (n.conversation_id) {
      setCurrentView('inbox');
      router.push(`/inbox/${n.conversation_id}`);
    }
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

  function toggleSelect(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAll() {
    if (selectedIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map((i) => i.id));
    }
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function executeBulkAction(action: 'resolve' | 'reopen' = 'resolve') {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch('/api/agent/conversations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, action })
      });
      if (res.ok) {
        setSelectedIds([]);
        await load(tab === 'resolved');
      }
    } catch (err) {
      console.error('[bulk] error', err);
    } finally {
      setBulkBusy(false);
    }
  }

  // Compteurs pour chaque segment
  const counts = useMemo(() => {
    return {
      all: items.length,
      mine: items.filter((i) => i.assigned_agent_id === agent.id).length,
      waiting: items.filter((i) => i.status === 'waiting').length,
      bot: items.filter((i) => i.status === 'bot').length,
      unreadTotal: items.reduce((acc, i) => acc + (i.unread_count || 0), 0)
    };
  }, [items, agent.id]);

  // Raccourcis clavier (j/k et flèches pour changer de conversation)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (currentView !== 'inbox') return;
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
  }, [filteredItems, selectedId, router, currentView]);

  function switchNav(view: string) {
    setCurrentView(view);
    setMobileMenuOpen(false);
    if (view === 'inbox') {
      if (selectedId) router.push(`/inbox/${selectedId}`);
      else router.push('/inbox');
    }
  }

  const activeCategory = TAB_CATEGORIES.find((c) => c.items.some((i) => i.key === currentView));
  const activeAdminItem = TAB_CATEGORIES.flatMap((c) => c.items).find((i) => i.key === currentView);

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-mist">
      {/* Backdrop Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/60 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          1. RAIL DE NAVIGATION PERMANENT À GAUCHE (SLACK / INTERCOM STYLE)
         ════════════════════════════════════════════════════════════════════════ */}
      <aside
        onMouseEnter={() => setRailHovered(true)}
        onMouseLeave={() => setRailHovered(false)}
        className={cn(
          'flex shrink-0 flex-col bg-ink-950 text-white transition-all duration-200 ease-out border-r border-white/10',
          'fixed inset-y-0 left-0 z-50 w-64 shadow-2xl md:static md:shadow-none md:z-40',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          isExpanded ? 'md:w-56' : 'md:w-16'
        )}
      >
        {/* Logo Orb Luminae + Toggle Collapse */}
        <div className="flex items-center justify-between border-b border-white/10 p-3">
          <button
            onClick={() => switchNav('inbox')}
            className="flex min-w-0 items-center gap-2.5 text-left"
            title="Luminae"
          >
            <BotOrb size={28} glow />
            <div className={cn('flex flex-col truncate', !isExpanded && 'md:hidden')}>
              <span className="truncate font-display text-sm font-bold tracking-tight text-white">Luminae</span>
              <span className="text-[10px] font-medium text-aurora-300">Support Hub</span>
            </div>
          </button>

          <button
            onClick={() => setRailCollapsed((c) => !c)}
            className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg text-mist-400 transition hover:bg-white/10 hover:text-white"
            title={!railCollapsed ? 'Détacher (repli automatique au survol)' : 'Épingler le menu ouvert'}
            aria-label={!railCollapsed ? 'Détacher le menu' : 'Épingler le menu'}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={cn('transition transform', !railCollapsed ? '' : 'rotate-180')}
            >
              <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          {/* Bouton fermer sur mobile */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="flex md:hidden h-8 w-8 items-center justify-center rounded-lg text-mist-400 hover:text-white"
            aria-label="Fermer le menu"
          >
            ✕
          </button>
        </div>

        {/* Liste des boutons d'application et paramètres */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-3">
          {/* Bouton principal : Conversations / Inbox */}
          <div className="space-y-1">
            <p className={cn('px-2 text-[9.5px] font-bold uppercase tracking-wider text-mist-400/60', !isExpanded && 'md:hidden')}>
              Messagerie
            </p>
            <button
              onClick={() => switchNav('inbox')}
              title={!isExpanded ? 'Conversations en direct' : undefined}
              className={cn(
                'group flex items-center shrink-0 rounded-xl text-xs font-medium transition w-full text-left',
                !isExpanded ? 'justify-between px-3 py-2 md:justify-center md:p-2.5' : 'justify-between gap-2.5 px-3 py-2',
                currentView === 'inbox'
                  ? 'bg-gradient-to-r from-lagoon-500/25 via-aurora-500/15 to-transparent text-white border-l-2 border-lagoon-400 shadow-sm font-semibold'
                  : 'text-mist-400 hover:bg-white/5 hover:text-white'
              )}
            >
              <div className={cn('flex items-center min-w-0', !isExpanded ? 'gap-2.5 md:justify-center' : 'gap-2.5')}>
                <span className={cn('transition', currentView === 'inbox' ? 'text-lagoon-400' : 'text-mist-400 group-hover:text-white')}>
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </span>
                <span className={cn('truncate', !isExpanded && 'md:hidden')}>Conversations</span>
              </div>

              {counts.waiting > 0 ? (
                <span className="rounded-full bg-sun-500 px-1.5 py-0.2 text-[9.5px] font-bold text-white animate-pulse">
                  {counts.waiting}
                </span>
              ) : counts.unreadTotal > 0 ? (
                <span className="rounded-full bg-coral-500 px-1.5 py-0.2 text-[9.5px] font-bold text-white">
                  {counts.unreadTotal}
                </span>
              ) : null}
            </button>
          </div>

          {/* Menus catégorisés du Cockpit Paramétrages */}
          {TAB_CATEGORIES.map((cat) => (
            <div key={cat.title} className="space-y-1 pt-1">
              <p className={cn('px-2 text-[9.5px] font-bold uppercase tracking-wider text-mist-400/60', !isExpanded && 'md:hidden')}>
                {cat.title}
              </p>
              <div className="space-y-0.5">
                {cat.items.map((t) => {
                  const active = currentView === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => switchNav(t.key)}
                      title={!isExpanded ? t.label : undefined}
                      className={cn(
                        'group flex items-center shrink-0 rounded-xl text-xs font-medium transition w-full text-left',
                        !isExpanded ? 'justify-between px-3 py-2 md:justify-center md:p-2.5' : 'justify-between gap-2.5 px-3 py-2',
                        active
                          ? 'bg-gradient-to-r from-aurora-500/20 via-lagoon-500/15 to-transparent text-white border-l-2 border-aurora-400 shadow-sm font-semibold'
                          : 'text-mist-400 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <div className={cn('flex items-center min-w-0', !isExpanded ? 'gap-2.5 md:justify-center' : 'gap-2.5')}>
                        <span className={cn('transition', active ? 'text-aurora-400' : 'text-mist-400 group-hover:text-white')}>
                          {t.icon}
                        </span>
                        <span className={cn('truncate', !isExpanded && 'md:hidden')}>{t.label}</span>
                      </div>
                      {t.badge && (
                        <span className={cn('rounded bg-aurora-500/20 px-1.5 py-0.2 text-[9.5px] font-bold text-aurora-300', !isExpanded && 'md:hidden')}>
                          {t.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer Agent & Déconnexion */}
        <div className="border-t border-white/10 p-2.5 bg-ink-950/80">
          <div className="flex items-center gap-2">
            <Avatar name={agent.full_name ?? agent.email} url={agent.avatar_url} size={28} online />
            <div className={cn('min-w-0 flex-1', !isExpanded && 'md:hidden')}>
              <p className="truncate text-xs font-semibold text-white">{agent.full_name ?? agent.email}</p>
              <span className="text-[10px] text-aurora-300 font-medium">{agent.role === 'admin' ? 'Administrateur' : 'Conseiller'}</span>
            </div>
            <button
              onClick={logout}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-mist-400 transition hover:bg-white/10 hover:text-white ml-auto"
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════════════════════════
          2. ESPACE DE TRAVAIL CENTRAL (CONVERSATIONS OU PARAMÈTRE SÉLECTIONNÉ)
         ════════════════════════════════════════════════════════════════════════ */}
      <div className="flex min-w-0 flex-1 overflow-hidden">
        {currentView === 'inbox' ? (
          <>
            {/* ── Colonne Liste des conversations ─────────────────────────────────── */}
            <aside
              className={cn(
                'flex w-full shrink-0 flex-col border-r border-mist-300 bg-white md:w-[330px] lg:w-[360px]',
                selectedId ? 'hidden md:flex' : 'flex'
              )}
            >
              {/* En-tête de la liste des conversations avec hamburger mobile */}
              <header className="relative z-30 flex items-center justify-between border-b border-mist-300/80 px-4 py-3 bg-white/80 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-600 hover:bg-mist transition md:hidden"
                    title="Ouvrir le menu de navigation"
                    aria-label="Menu de navigation"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                  </button>
                  <span className="font-display text-sm font-bold tracking-tight text-ink">Boîte de réception</span>
                  <span className="rounded-full bg-lagoon-100 px-2 py-0.5 text-[10.5px] font-bold text-lagoon-700">
                    {items.length}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCannedOpen(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-500 transition hover:bg-mist hover:text-ink"
                    title="Réponses rapides (⚡)"
                    aria-label="Réponses rapides"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  </button>

                  {/* Centre de notifications */}
                  <div className="relative">
                    <button
                      onClick={() => setNotifOpen((o) => !o)}
                      className="relative flex h-8 w-8 items-center justify-center rounded-xl text-ink-500 transition hover:bg-mist hover:text-ink"
                      title="Notifications"
                      aria-label="Notifications"
                      aria-expanded={notifOpen}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.7 21a2 2 0 01-3.4 0" />
                      </svg>
                      {notifs.length > 0 && (
                        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-coral-500 ring-2 ring-white" />
                      )}
                    </button>

                    {notifOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setNotifOpen(false)}
                          aria-hidden
                        />
                        <div
                          role="dialog"
                          aria-label="Centre de notifications"
                          className="absolute -right-16 md:-right-20 top-10 z-50 w-80 max-w-[calc(100vw-24px)] animate-slide-up rounded-2xl border border-mist-300 bg-white p-3 shadow-panel"
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
                      </>
                    )}
                  </div>
                </div>
              </header>

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

              {/* Barre d'action groupée / Sélection globale */}
              {filteredItems.length > 0 && (
                <div
                  className={cn(
                    'flex items-center justify-between border-b px-3 py-1.5 text-xs transition-colors',
                    selectedIds.length > 0
                      ? 'border-lagoon-300 bg-lagoon-50/90 text-lagoon-700 shadow-sm'
                      : 'border-mist-200 bg-mist-50/60 text-ink-500'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAll}
                      title={
                        selectedIds.length === filteredItems.length
                          ? 'Tout désélectionner'
                          : 'Tout sélectionner'
                      }
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded border transition',
                        selectedIds.length === filteredItems.length && filteredItems.length > 0
                          ? 'border-lagoon-600 bg-lagoon-600 text-white'
                          : selectedIds.length > 0
                            ? 'border-lagoon-600 bg-lagoon-100 text-lagoon-700'
                            : 'border-mist-400 bg-white hover:border-ink-400'
                      )}
                    >
                      {selectedIds.length > 0 && (
                        <svg className="h-3 w-3 stroke-current stroke-[2.5]" viewBox="0 0 24 24" fill="none">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-[11px] font-medium hover:text-ink transition"
                    >
                      {selectedIds.length > 0 ? (
                        <span className="font-bold text-lagoon-700">
                          {selectedIds.length} sélectionnée{selectedIds.length > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span>Tout cocher ({filteredItems.length})</span>
                      )}
                    </button>
                  </div>

                  {selectedIds.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={bulkBusy}
                        onClick={() => executeBulkAction(tab === 'resolved' ? 'reopen' : 'resolve')}
                        className="inline-flex items-center gap-1 rounded-lg bg-lagoon-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-lagoon-700 active:scale-95 transition disabled:opacity-50"
                      >
                        {bulkBusy ? (
                          <span>Patientez…</span>
                        ) : tab === 'resolved' ? (
                          <>
                            <span>🔄</span>
                            <span>Rouvrir ({selectedIds.length})</span>
                          </>
                        ) : (
                          <>
                            <span>✅</span>
                            <span>Tout résoudre ({selectedIds.length})</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={clearSelection}
                        className="rounded-lg p-1 text-lagoon-700 hover:bg-lagoon-200/60 transition"
                        title="Annuler la sélection"
                      >
                        ✕
                      </button>
                    </div>
                  )}
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
                  const isChecked = selectedIds.includes(it.id);
                  return (
                    <li key={it.id} className="relative group">
                      <div
                        className={cn(
                          'relative flex items-start gap-2.5 p-3 text-left transition-all',
                          isChecked ? 'bg-lagoon-50/80' : isSelected ? 'bg-lagoon-50/50' : 'hover:bg-mist-50 bg-white'
                        )}
                      >
                        {/* Liseré indicateur d'état à gauche */}
                        <span
                          className={cn(
                            'absolute left-0 top-0 bottom-0 w-1 transition-all',
                            isSelected && 'w-1.5 bg-lagoon-600',
                            !isSelected && !isChecked && it.status === 'waiting' && 'bg-sun-500',
                            !isSelected && !isChecked && it.status === 'bot' && 'bg-aurora-400',
                            !isSelected && !isChecked && it.status === 'assigned' && 'bg-lagoon-400',
                            !isSelected && !isChecked && it.status === 'resolved' && 'bg-transparent'
                          )}
                        />

                        {/* Checkbox de sélection rapide */}
                        <button
                          type="button"
                          onClick={(e) => toggleSelect(it.id, e)}
                          title={isChecked ? 'Désélectionner' : 'Sélectionner'}
                          className={cn(
                            'mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition z-10',
                            isChecked
                              ? 'border-lagoon-600 bg-lagoon-600 text-white shadow-sm'
                              : selectedIds.length > 0
                                ? 'border-mist-400 bg-white hover:border-lagoon-500'
                                : 'opacity-0 group-hover:opacity-100 border-mist-400 bg-white hover:border-lagoon-500'
                          )}
                        >
                          {isChecked && (
                            <svg className="h-3 w-3 stroke-current stroke-[2.5]" viewBox="0 0 24 24" fill="none">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => router.push(`/inbox/${it.id}`)}
                          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                        >
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
                        </button>
                      </div>
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
                      Utilisez les touches <kbd className="rounded border border-mist-300 bg-white px-1.5 py-0.5 text-[11px] font-mono shadow-sm">J</kbd> et <kbd className="rounded border border-mist-300 bg-white px-1.5 py-0.5 text-[11px] font-mono shadow-sm">K</kbd> pour naviguer rapidement.
                    </p>
                  </div>
                </div>
              )}
            </main>
          </>
        ) : (
          /* ── Zone Paramétrages Admin Intégrée (Même Page, Pleine Largeur Responsive) ─────── */
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-mist">
            <div className="sticky top-0 z-10 border-b border-mist-300/80 bg-white/80 px-4 py-2.5 backdrop-blur-md flex items-center justify-between gap-3 text-xs text-ink-500 shadow-sm md:px-6">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-600 hover:bg-mist transition md:hidden"
                  title="Ouvrir le menu"
                  aria-label="Menu"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>
                <span className="text-ink-400 font-medium hidden sm:inline">Cockpit</span>
                <span className="hidden sm:inline">&rsaquo;</span>
                <span className="font-medium text-ink-600 hidden xs:inline">{activeCategory?.title}</span>
                <span className="hidden xs:inline">&rsaquo;</span>
                <span className="font-bold text-ink truncate max-w-[140px] sm:max-w-none">{activeAdminItem?.label}</span>
              </div>

              <button
                onClick={() => switchNav('inbox')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-mist-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-sm transition hover:bg-mist hover:text-ink shrink-0"
              >
                <span>&larr;</span>
                <span className="hidden sm:inline">Retour aux conversations</span>
                <span className="sm:hidden">Retour</span>
              </button>
            </div>

            <div className={cn('mx-auto px-4 py-6 md:px-6 md:py-8', currentView === 'stats' ? 'max-w-5xl' : 'max-w-3xl')}>
              {currentView === 'stats' && <StatsPanel />}
              {currentView === 'workflows' && <WorkflowsPanel />}
              {currentView === 'bot' && <BotSettingsForm />}
              {currentView === 'kb' && <ArticlesPanel />}
              {currentView === 'canned' && <CannedPanel agent={agent} variant="inline" />}
              {currentView === 'prechat' && <PrechatPanel />}
              {currentView === 'triggers' && <TriggersPanel />}
              {(currentView === 'integrations' || currentView === 'telephony') && <IntegrationsPanel />}
              {currentView === 'routing' && <RoutingPanel />}
              {currentView === 'hours' && <BusinessHoursForm />}
              {currentView === 'absences' && <AbsencesPanel />}
              {currentView === 'team' && <TeamPanel selfId={agent.id} />}
              {currentView === 'security' && <SecurityPanel />}
              {currentView === 'webhooks' && <WebhooksPanel />}
            </div>
          </main>
        )}
      </div>

      {cannedOpen && <CannedPanel agent={agent} variant="modal" onClose={() => setCannedOpen(false)} />}
    </div>
  );
}