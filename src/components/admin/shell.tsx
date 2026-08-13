'use client';

/** Coquille du back-office : navigation latérale + sections admin. */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

const TABS = [
  { key: 'stats', label: 'Statistiques' },
  { key: 'bot', label: 'Bot & widget' },
  { key: 'hours', label: 'Horaires d’ouverture' },
  { key: 'kb', label: 'Base de connaissances' },
  { key: 'canned', label: 'Réponses rapides' },
  { key: 'team', label: 'Équipe' },
  { key: 'absences', label: 'Absences' }
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function AdminShell({ agent }: { agent: Agent }) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [tab, setTab] = useState<TabKey>('stats');

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    // Sous md, la navigation devient un bandeau supérieur et le contenu passe
    // dessous ; à partir de md on retrouve la barre latérale. Un tiroir aurait
    // demandé un overlay et un piège de focus — un bandeau défilable rend le
    // back-office utilisable en mobilité sans cette machinerie.
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-mist md:flex-row">
      {/* Navigation */}
      <aside className="flex w-full shrink-0 flex-col bg-ink text-white md:w-64">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-5 md:py-4">
          <Link href="/inbox" className="flex min-w-0 items-center gap-2" title="Retour à la boîte de réception">
            <BotOrb size={26} glow={false} />
            <span className="truncate font-display text-base font-semibold tracking-tight">Luminae</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-aurora-300">
              Admin
            </span>
            {/* Le bloc de pied de page est masqué sous md : la déconnexion doit
                rester atteignable depuis le bandeau. */}
            <button
              onClick={logout}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-300 transition hover:bg-white/10 hover:text-white md:hidden"
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

        <nav className="flex gap-1 overflow-x-auto p-2 md:flex-1 md:flex-col md:overflow-x-visible md:overflow-y-auto md:p-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? 'page' : undefined}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition md:w-full md:py-2.5 md:text-left',
                tab === t.key ? 'bg-white/15 text-white' : 'text-ink-300 hover:bg-white/5 hover:text-white'
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="hidden border-t border-white/10 p-4 md:block">
          <div className="flex items-center gap-2.5">
            <Avatar name={agent.full_name ?? agent.email} url={agent.avatar_url} size={30} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{agent.full_name ?? agent.email}</p>
              <Link href="/inbox" className="text-[11px] text-aurora-300 hover:underline">
                ← Boîte de réception
              </Link>
            </div>
            <button
              onClick={logout}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-300 transition hover:bg-white/10 hover:text-white"
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
        </div>
      </aside>

      {/* Contenu de la section active */}
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className={cn('mx-auto px-4 py-6 md:px-6 md:py-8', tab === 'stats' ? 'max-w-5xl' : 'max-w-3xl')}>
          {tab === 'stats' && <StatsPanel />}
          {tab === 'bot' && <BotSettingsForm />}
          {tab === 'hours' && <BusinessHoursForm />}
          {tab === 'kb' && <ArticlesPanel />}
          {tab === 'canned' && <CannedPanel agent={agent} variant="inline" />}
          {tab === 'team' && <TeamPanel selfId={agent.id} />}
          {tab === 'absences' && <AbsencesPanel />}
        </div>
      </main>
    </div>
  );
}