'use client';

/** Coquille du back-office : navigation latérale + sections admin complètes (Freshchat / Intercom style). */

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
import { TriggersPanel } from './triggers';
import { PrechatPanel } from './prechat';
import { WebhooksPanel } from './webhooks';
import { SecurityPanel } from './security';

const TABS = [
  {
    key: 'stats',
    label: 'Statistiques',
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
  {
    key: 'bot',
    label: 'Bot & Identité Lumi',
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  },
  {
    key: 'routing',
    label: 'Routage & Distribution',
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
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
    key: 'prechat',
    label: 'Formulaire Pré-Chat',
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
    label: 'Réponses rapides',
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
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
    label: 'Équipe & Accès',
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
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
  },
  {
    key: 'security',
    label: 'Sécurité & RGPD',
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    )
  }
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function AdminShell({ agent }: { agent: Agent }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = supabaseBrowser();
  
  const queryTab = searchParams?.get('tab') as TabKey | null;
  const initialTab = queryTab && TABS.some((t) => t.key === queryTab) ? queryTab : 'stats';
  const [tab, setTab] = useState<TabKey>(initialTab);

  useEffect(() => {
    if (queryTab && TABS.some((t) => t.key === queryTab)) {
      setTab(queryTab);
    }
  }, [queryTab]);

  function switchTab(newTab: TabKey) {
    setTab(newTab);
    router.replace(`/admin?tab=${newTab}`, { scroll: false });
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-mist md:flex-row">
      {/* Navigation latérale sombre */}
      <aside className="flex w-full shrink-0 flex-col bg-ink-950 text-white md:w-64 border-r border-white/10">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5 md:px-5 md:py-4">
          <Link href="/inbox" className="flex min-w-0 items-center gap-2.5" title="Retour à la boîte de réception">
            <BotOrb size={28} glow />
            <div className="flex flex-col">
              <span className="truncate font-display text-base font-bold tracking-tight text-white">Luminae</span>
              <span className="text-[10px] font-medium text-aurora-300">Cockpit Admin</span>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-aurora-500/30 bg-aurora-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-aurora-300">
              Admin
            </span>
            <button
              onClick={logout}
              className="flex h-8 w-8 items-center justify-center rounded-full text-mist-400 transition hover:bg-white/10 hover:text-white md:hidden"
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        <nav role="tablist" aria-label="Sections d'administration" className="flex gap-1 overflow-x-auto p-2 md:flex-1 md:flex-col md:overflow-x-visible md:overflow-y-auto md:p-3 space-y-0.5">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => switchTab(t.key)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition md:w-full md:py-2 md:text-left',
                  active
                    ? 'bg-gradient-to-r from-aurora-500/20 via-lagoon-500/15 to-transparent text-white border-l-2 border-aurora-400 shadow-sm'
                    : 'text-mist-400 hover:bg-white/5 hover:text-white'
                )}
              >
                <span className={active ? 'text-aurora-400' : 'text-mist-400'}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="hidden border-t border-white/10 p-3.5 md:block bg-ink-950/80">
          <div className="flex items-center gap-2.5">
            <Avatar name={agent.full_name ?? agent.email} url={agent.avatar_url} size={30} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{agent.full_name ?? agent.email}</p>
              <Link href="/inbox" className="text-[10.5px] text-aurora-300 hover:underline">
                &larr; Boîte de réception
              </Link>
            </div>
            <button
              onClick={logout}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-mist-400 transition hover:bg-white/10 hover:text-white"
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Contenu de la section active */}
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className={cn('mx-auto px-4 py-6 md:px-6 md:py-8', tab === 'stats' ? 'max-w-5xl' : 'max-w-3xl')}>
          {tab === 'stats' && <StatsPanel />}
          {tab === 'bot' && <BotSettingsForm />}
          {tab === 'routing' && <RoutingPanel />}
          {tab === 'triggers' && <TriggersPanel />}
          {tab === 'prechat' && <PrechatPanel />}
          {tab === 'kb' && <ArticlesPanel />}
          {tab === 'canned' && <CannedPanel agent={agent} variant="inline" />}
          {tab === 'hours' && <BusinessHoursForm />}
          {tab === 'absences' && <AbsencesPanel />}
          {tab === 'team' && <TeamPanel selfId={agent.id} />}
          {tab === 'webhooks' && <WebhooksPanel />}
          {tab === 'security' && <SecurityPanel />}
        </div>
      </main>
    </div>
  );
}