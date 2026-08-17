'use client';

/** Coquille du back-office : navigation latérale catégorisée, repliable (icônes / étendu) et intégrable dans l'Inbox. */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { BotOrb } from '@/components/widget/parts';
import { Avatar } from '@/components/inbox/parts';
import { cn } from '@/lib/utils';
import type { Agent } from '@/lib/types';
import { BotSettingsForm } from './bot-settings';
import { BusinessHoursForm } from './business-hours';
import { TeamPanel } from './team';
import { AbsencesPanel } from './absences';
import { ArticlesPanel } from './articles';
import { CannedPanel } from '@/components/inbox/canned-panel';
import { StatsPanel } from './stats';
import { RoutingPanel } from './routing';
import { WorkflowsPanel } from './workflows';
import { TriggersPanel } from './triggers';
import { PrechatPanel } from './prechat';
import { IntegrationsPanel } from './integrations';
import { WebhooksPanel } from './webhooks';
import { SecurityPanel } from './security';

interface TabItem {
  key: string;
  label: string;
  badge?: string;
  icon: React.ReactNode;
}

interface TabCategory {
  title: string;
  items: TabItem[];
}

export const TAB_CATEGORIES: TabCategory[] = [
  {
    title: 'Pilotage & Stats',
    items: [
      {
        key: 'stats',
        label: 'Statistiques & Intentions',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        )
      }
    ]
  },
  {
    title: 'Intelligence Artificielle',
    items: [
      {
        key: 'bot',
        label: 'Identité & Bot Lumi',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        )
      },
      {
        key: 'workflows',
        label: 'Workflows & Auto',
        badge: 'New',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )
      },
      {
        key: 'kb',
        label: 'Base de connaissances',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        )
      },
      {
        key: 'canned',
        label: 'Réponses rapides (#)',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )
      }
    ]
  },
  {
    title: 'Canaux & Visiteurs',
    items: [
      {
        key: 'prechat',
        label: 'Formulaire Pré-Chat',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
      },
      {
        key: 'triggers',
        label: 'Messages Proactifs',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        )
      },
      {
        key: 'integrations',
        label: 'Intégrations & Connecteurs',
        badge: 'Quicktalk / Slack',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
          </svg>
        )
      }
    ]
  },
  {
    title: 'Équipe & Horaires',
    items: [
      {
        key: 'routing',
        label: 'Routage & Escalade',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        )
      },
      {
        key: 'hours',
        label: 'Horaires d’ouverture',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      },
      {
        key: 'absences',
        label: 'Absences & Congés',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )
      },
      {
        key: 'team',
        label: 'Équipe & Conseillers',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        )
      }
    ]
  },
  {
    title: 'Sécurité & Intégrations',
    items: [
      {
        key: 'security',
        label: 'Sécurité & RGPD',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        )
      },
      {
        key: 'webhooks',
        label: 'Webhooks & API',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        )
      }
    ]
  }
];

const ALL_TAB_KEYS = TAB_CATEGORIES.flatMap((c) => c.items.map((i) => i.key));
type TabKey = string;

export function AdminShell({
  agent,
  onClose,
  isDrawer = false
}: {
  agent: Agent;
  onClose?: () => void;
  isDrawer?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = supabaseBrowser();

  const queryTab = searchParams?.get('tab') as TabKey | null;
  const initialTab = queryTab && ALL_TAB_KEYS.includes(queryTab) ? queryTab : 'stats';
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [collapsed, setCollapsed] = useState<boolean>(false);

  useEffect(() => {
    if (queryTab && ALL_TAB_KEYS.includes(queryTab)) {
      setTab(queryTab);
    }
  }, [queryTab]);

  // Raccourci ESC pour fermer le panneau si embedded
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function switchTab(newTab: TabKey) {
    setTab(newTab);
    if (!isDrawer) {
      router.replace(`/admin?tab=${newTab}`, { scroll: false });
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const activeCategory = TAB_CATEGORIES.find((c) => c.items.some((i) => i.key === tab));
  const activeItem = TAB_CATEGORIES.flatMap((c) => c.items).find((i) => i.key === tab);

  return (
    <div className={cn('flex h-full w-full flex-col overflow-hidden bg-mist md:flex-row', isDrawer && 'shadow-2xl')}>
      {/* Navigation latérale sombre haut de gamme rétractable */}
      <aside
        className={cn(
          'flex shrink-0 flex-col bg-ink-950 text-white transition-all duration-200 border-r border-white/10',
          collapsed ? 'w-full md:w-16' : 'w-full md:w-64'
        )}
      >
        {/* En-tête : logo + toggle collapse */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3.5 py-3 md:py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <BotOrb size={26} glow />
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="truncate font-display text-sm font-bold tracking-tight text-white">Luminae</span>
                <span className="text-[10px] font-medium text-aurora-300">Paramétrages</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Bouton Réduire / Développer le menu */}
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg text-mist-400 transition hover:bg-white/10 hover:text-white"
              title={collapsed ? 'Développer le menu (Large)' : 'Réduire le menu (Icônes)'}
              aria-label={collapsed ? 'Développer le menu' : 'Réduire le menu'}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={cn('transition transform', collapsed ? 'rotate-180' : '')}
              >
                <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>

            {onClose ? (
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-mist-400 transition hover:bg-white/10 hover:text-white"
                title="Fermer les paramètres (ESC)"
                aria-label="Fermer les paramètres"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            ) : (
              <button
                onClick={logout}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-mist-400 transition hover:bg-white/10 hover:text-white md:hidden"
                title="Se déconnecter"
                aria-label="Se déconnecter"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Navigation organisée par catégories avec mode compact */}
        <nav
          role="tablist"
          aria-label="Sections d'administration"
          className={cn(
            'flex gap-1 overflow-x-auto p-2 md:flex-1 md:flex-col md:overflow-x-visible md:overflow-y-auto space-y-3',
            collapsed ? 'md:p-2 md:space-y-2' : 'md:p-3'
          )}
        >
          {TAB_CATEGORIES.map((cat) => (
            <div key={cat.title} className="space-y-1">
              {!collapsed && (
                <p className="hidden md:block px-3 text-[9.5px] font-bold uppercase tracking-wider text-mist-400/60">
                  {cat.title}
                </p>
              )}
              <div className="flex md:flex-col gap-0.5">
                {cat.items.map((t) => {
                  const active = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      role="tab"
                      aria-selected={active}
                      onClick={() => switchTab(t.key)}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? t.label : undefined}
                      className={cn(
                        'group flex items-center shrink-0 whitespace-nowrap rounded-xl text-xs font-medium transition md:w-full md:text-left',
                        collapsed
                          ? 'justify-center p-2.5'
                          : 'justify-between gap-2.5 px-3 py-2',
                        active
                          ? 'bg-gradient-to-r from-aurora-500/20 via-lagoon-500/15 to-transparent text-white border-l-2 border-aurora-400 shadow-sm font-semibold'
                          : 'text-mist-400 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <div className={cn('flex items-center min-w-0', collapsed ? 'justify-center' : 'gap-2.5')}>
                        <span className={cn('transition', active ? 'text-aurora-400' : 'text-mist-400 group-hover:text-white')}>
                          {t.icon}
                        </span>
                        {!collapsed && <span className="truncate">{t.label}</span>}
                      </div>
                      {!collapsed && t.badge && (
                        <span className="hidden md:inline rounded bg-aurora-500/20 px-1.5 py-0.2 text-[9.5px] font-bold text-aurora-300">
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

        {/* Footer Agent & Bouton Retour / Déconnexion */}
        <div className="hidden border-t border-white/10 p-3 md:block bg-ink-950/80">
          <div className="flex items-center gap-2">
            <Avatar name={agent.full_name ?? agent.email} url={agent.avatar_url} size={28} />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">{agent.full_name ?? agent.email}</p>
                {onClose ? (
                  <button onClick={onClose} className="text-[10.5px] text-aurora-300 hover:underline">
                    &larr; Fermer les paramètres
                  </button>
                ) : (
                  <Link href="/inbox" className="text-[10.5px] text-aurora-300 hover:underline">
                    &larr; Boîte de réception
                  </Link>
                )}
              </div>
            )}
            <button
              onClick={onClose ?? logout}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-mist-400 transition hover:bg-white/10 hover:text-white"
              title={onClose ? 'Fermer les paramètres' : 'Se déconnecter'}
              aria-label={onClose ? 'Fermer' : 'Déconnexion'}
            >
              {onClose ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Contenu de la section active avec fil d'ariane & bouton de fermeture */}
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-mist">
        <div className="sticky top-0 z-10 border-b border-mist-300/80 bg-white/80 px-6 py-2.5 backdrop-blur-md flex items-center justify-between gap-3 text-xs text-ink-500 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="md:hidden flex h-6 w-6 items-center justify-center rounded text-ink-500 hover:bg-mist"
              title="Basculer le menu"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span className="text-ink-400 font-medium">Cockpit Paramétrages</span>
            <span>&rsaquo;</span>
            <span className="font-medium text-ink-600">{activeCategory?.title}</span>
            <span>&rsaquo;</span>
            <span className="font-bold text-ink">{activeItem?.label}</span>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg border border-mist-300 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 shadow-sm transition hover:bg-mist hover:text-ink"
            >
              <span>✕</span>
              <span>Fermer</span>
            </button>
          )}
        </div>

        <div className={cn('mx-auto px-4 py-6 md:px-6 md:py-8', tab === 'stats' ? 'max-w-5xl' : 'max-w-3xl')}>
          {tab === 'stats' && <StatsPanel />}
          {tab === 'workflows' && <WorkflowsPanel />}
          {tab === 'bot' && <BotSettingsForm />}
          {tab === 'kb' && <ArticlesPanel />}
          {tab === 'canned' && <CannedPanel agent={agent} variant="inline" />}
          {tab === 'prechat' && <PrechatPanel />}
          {tab === 'triggers' && <TriggersPanel />}
          {(tab === 'integrations' || tab === 'telephony') && <IntegrationsPanel />}
          {tab === 'routing' && <RoutingPanel />}
          {tab === 'hours' && <BusinessHoursForm />}
          {tab === 'absences' && <AbsencesPanel />}
          {tab === 'team' && <TeamPanel selfId={agent.id} />}
          {tab === 'security' && <SecurityPanel />}
          {tab === 'webhooks' && <WebhooksPanel />}
        </div>
      </main>
    </div>
  );
}