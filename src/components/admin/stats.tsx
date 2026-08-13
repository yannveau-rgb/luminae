'use client';

/** Statistiques : volumes, répartition bot/escaladées, taux de feedback. */

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, SectionHeader } from './parts';

interface StatsPayload {
  range: { days: number; from: string; to: string };
  totals: {
    conversations: number;
    bot_only: number;
    escalated: number;
    resolved: number;
    feedback_up: number;
    feedback_down: number;
  };
  previous: { conversations: number; escalated: number };
  daily: { date: string; count: number }[];
}

const RANGES = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: 90, label: '90 jours' }
] as const;

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function delta(current: number, previous: number): { direction: 'up' | 'down' | 'flat'; text: string } {
  if (previous === 0) return { direction: current > 0 ? 'up' : 'flat', text: current > 0 ? 'nouveau' : '—' };
  const diff = Math.round(((current - previous) / previous) * 100);
  if (diff === 0) return { direction: 'flat', text: '±0 %' };
  return { direction: diff > 0 ? 'up' : 'down', text: `${diff > 0 ? '+' : ''}${diff} %` };
}

function StatTile({
  label,
  value,
  trend
}: {
  label: string;
  value: string;
  trend?: { direction: 'up' | 'down' | 'flat'; text: string; goodDirection: 'up' | 'down' };
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-display text-2xl font-semibold tracking-tight text-ink">{value}</span>
        {trend && trend.direction !== 'flat' && (
          <span
            className={cn(
              'text-xs font-medium',
              trend.direction === trend.goodDirection ? 'text-lagoon-600' : 'text-coral-600'
            )}
          >
            {trend.direction === 'up' ? '↑' : '↓'} {trend.text}
          </span>
        )}
        {trend && trend.direction === 'flat' && <span className="text-xs font-medium text-ink-400">{trend.text}</span>}
      </div>
    </Card>
  );
}

/** Barre empilée à deux segments avec légende directe (identité jamais portée par la seule couleur). */
function SplitBar({
  title,
  segments
}: {
  title: string;
  segments: { label: string; value: number; colorClass: string; textClass: string }[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-ink-500">{title}</p>
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-mist-300" role="img" aria-label={title}>
        {segments.map((s, i) => {
          const width = pct(s.value, total);
          if (width <= 0) return null;
          return (
            <div
              key={s.label}
              className={cn(s.colorClass, i > 0 && 'ml-0.5')}
              style={{ width: `${width}%` }}
              title={`${s.label} : ${s.value} (${width} %)`}
            />
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', s.colorClass)} />
            <span className="text-ink-500">{s.label}</span>
            <span className={cn('font-semibold', s.textClass)}>
              {s.value} ({pct(s.value, total)} %)
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DailyBarChart({ daily }: { daily: { date: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...daily.map((d) => d.count));
  const showEveryLabel = daily.length <= 14;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-500">Conversations par jour</p>
        {hover !== null && (
          <p className="text-xs font-semibold text-ink">
            {new Date(daily[hover].date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ·{' '}
            {daily[hover].count} conversation{daily[hover].count > 1 ? 's' : ''}
          </p>
        )}
      </div>
      <div className="mt-4 flex h-32 gap-[3px]">
        {daily.map((d, i) => (
          <div
            key={d.date}
            className="group relative flex h-full flex-1 items-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
          >
            <div
              className={cn(
                'w-full rounded-t-[4px] transition-colors',
                hover === i ? 'bg-lagoon-600' : 'bg-lagoon-400'
              )}
              style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }}
            />
            {showEveryLabel && (
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-ink-400">
                {new Date(d.date).getDate()}
              </span>
            )}
          </div>
        ))}
      </div>
      {showEveryLabel && <div className="h-5" />}
    </Card>
  );
}

export function StatsPanel() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/stats?days=${d}`, { cache: 'no-store' });
    if (res.ok) {
      setData(await res.json());
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'Impossible de charger les statistiques.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  return (
    <div>
      <SectionHeader
        title="Statistiques"
        description="Volumes de conversations, répartition bot/agents et satisfaction, sur la période choisie."
      />

      <div className="mb-5 flex gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium transition',
              days === r.days ? 'bg-ink text-white' : 'bg-white text-ink-500 hover:bg-mist-300/60'
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-ink-400">Chargement…</p>}
      {error && !loading && <p className="text-sm text-coral-600">{error}</p>}

      {data && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile
              label="Conversations"
              value={String(data.totals.conversations)}
              trend={{ ...delta(data.totals.conversations, data.previous.conversations), goodDirection: 'up' }}
            />
            <StatTile
              label="Taux d'escalade"
              value={`${pct(data.totals.escalated, data.totals.conversations)} %`}
              trend={{
                ...delta(data.totals.escalated, data.previous.escalated),
                goodDirection: 'down'
              }}
            />
            <StatTile
              label="Feedback positif"
              value={`${pct(data.totals.feedback_up, data.totals.feedback_up + data.totals.feedback_down)} %`}
            />
          </div>

          <DailyBarChart daily={data.daily} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SplitBar
              title="Bot seul vs escaladées"
              segments={[
                { label: 'Résolu par le bot', value: data.totals.bot_only, colorClass: 'bg-aurora-400', textClass: 'text-aurora-600' },
                { label: 'Escaladée à un agent', value: data.totals.escalated, colorClass: 'bg-coral-500', textClass: 'text-coral-600' }
              ]}
            />
            <SplitBar
              title="Feedback visiteurs"
              segments={[
                { label: '👍 Utile', value: data.totals.feedback_up, colorClass: 'bg-lagoon-500', textClass: 'text-lagoon-600' },
                { label: '👎 Pas utile', value: data.totals.feedback_down, colorClass: 'bg-coral-500', textClass: 'text-coral-600' }
              ]}
            />
          </div>

          <p className="text-[11px] text-ink-400">
            {data.totals.resolved} conversation{data.totals.resolved > 1 ? 's' : ''} résolue
            {data.totals.resolved > 1 ? 's' : ''} sur la période · comparaison vs les {data.range.days} jours précédents.
          </p>
        </div>
      )}
    </div>
  );
}
