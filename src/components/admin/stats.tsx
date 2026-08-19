'use client';

/** Statistiques avancées : volumes, intentions de contact analysées par IA, exports CSV/JSON. */

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, SectionHeader } from './parts';

interface IntentStat {
  id: string;
  label: string;
  category: string;
  icon: string;
  colorClass: string;
  badgeClass: string;
  count: number;
  percentage: number;
  botOnlyCount: number;
  escalatedCount: number;
  botResolutionRate: number;
}

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
  intents?: IntentStat[];
}

const RANGES = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: 90, label: '90 jours' },
  { days: 365, label: '1 an' }
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
  trend,
  subtext
}: {
  label: string;
  value: string;
  trend?: { direction: 'up' | 'down' | 'flat'; text: string; goodDirection: 'up' | 'down' };
  subtext?: string;
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
      {subtext && <p className="mt-1 text-[11px] text-ink-400">{subtext}</p>}
    </Card>
  );
}

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

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-500">Volume quotidien de conversations</p>
        {hover !== null && (
          <p className="text-xs font-semibold text-ink">
            {new Date(daily[hover].date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ·{' '}
            {daily[hover].count} conversation{daily[hover].count > 1 ? 's' : ''}
          </p>
        )}
      </div>
      <div className="mt-4 flex h-32 gap-[2px]">
        {daily.map((d, i) => (
          <div
            key={d.date}
            className="group relative flex h-full flex-1 items-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
          >
            <div
              className={cn(
                'w-full rounded-t-[3px] transition-colors',
                hover === i ? 'bg-lagoon-600' : 'bg-lagoon-400'
              )}
              style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function StatsPanel() {
  const [days, setDays] = useState<(typeof RANGES)[number]['days']>(30);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [briefing, setBriefing] = useState<any>(null);
  const [briefingBusy, setBriefingBusy] = useState(false);

  const loadBriefing = useCallback(async () => {
    setBriefingBusy(true);
    try {
      const res = await fetch('/api/admin/stats/ai-briefing', { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        setBriefing(j.briefing);
      }
    } catch {
      // ignore
    } finally {
      setBriefingBusy(false);
    }
  }, []);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    const res = await fetch(`/api/admin/stats?days=${d}`, { cache: 'no-store' });
    if (res.ok) {
      const j = await res.json();
      setStats(j);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(days);
    loadBriefing();
  }, [days, load, loadBriefing]);

  function triggerExport(format: 'csv' | 'json') {
    const url = `/api/admin/stats/export?days=${days}&format=${format}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `luminae-stats-${days}j.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading && !stats) {
    return <p className="text-sm text-ink-400">Calcul des statistiques…</p>;
  }

  if (!stats) {
    return <p className="text-sm text-coral-600">Impossible de charger les statistiques.</p>;
  }

  const { totals, previous, daily, intents = [] } = stats;
  const totalFeedback = totals.feedback_up + totals.feedback_down;
  const botResolutionRate = pct(totals.bot_only, totals.conversations);

  return (
    <div className="space-y-6">
      {/* En-tête avec sélecteur de période et boutons d'export */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          title="Tableau de Bord & Statistiques"
          description="Analysez les volumes d'activité, la performance de l'IA Lumi et les causes de contact des visiteurs."
        />

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sélecteur de période */}
          <div className="inline-flex rounded-xl border border-mist-300 bg-white p-1 shadow-sm">
            {RANGES.map((r) => {
              const active = days === r.days;
              return (
                <button
                  key={r.days}
                  onClick={() => setDays(r.days)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-medium transition',
                    active ? 'bg-lagoon-600 text-white shadow-sm' : 'text-ink-600 hover:bg-mist hover:text-ink'
                  )}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          {/* Boutons d'export */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => triggerExport('csv')}
              title="Exporter les données au format CSV (Excel / Sheets)"
              className="inline-flex items-center gap-1.5 rounded-xl border border-mist-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:bg-mist-100 hover:border-mist-400"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => triggerExport('json')}
              title="Exporter les données brutes au format JSON"
              className="inline-flex items-center gap-1.5 rounded-xl border border-mist-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-600 shadow-sm transition hover:bg-mist-100"
            >
              <span>JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION EXÉCUTIVE : Synthèse Hebdomadaire IA pour la Direction ── */}
      <div className="rounded-3xl border border-aurora-300/80 bg-gradient-to-br from-aurora-100/70 via-white to-lagoon-50/50 p-5 text-ink shadow-sm space-y-3.5 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-aurora-300/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-lagoon-600 text-white text-sm shadow-sm">
              ✨
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-bold text-ink">
                  Synthèse Stratégique & Briefing Exécutif (IA Mistral)
                </h3>
                <span className="rounded-full bg-lagoon-100 px-2 py-0.5 text-[10px] font-bold text-lagoon-700 border border-lagoon-200">
                  {briefing?.period || 'Semaine en cours'}
                </span>
              </div>
              <p className="text-xs text-ink-500">
                {briefing?.headline || 'Audit automatique des performances du service client.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadBriefing}
            disabled={briefingBusy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-mist-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm hover:bg-mist transition disabled:opacity-50"
          >
            <span>{briefingBusy ? '⏳' : '🔄'}</span>
            <span>{briefingBusy ? 'Analyse…' : 'Régénérer la synthèse'}</span>
          </button>
        </div>

        {briefing ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-1 text-xs">
            {/* Faits Marquants */}
            <div className="rounded-2xl border border-mist-200 bg-white/90 p-3.5 space-y-2 shadow-sm">
              <span className="font-bold text-lagoon-700 flex items-center gap-1.5 text-[11.5px]">
                <span>🏆</span>
                <span>Faits Marquants</span>
              </span>
              <ul className="space-y-1.5 text-[11px] text-ink-700 list-disc list-inside leading-relaxed">
                {(briefing.highlights || []).map((h: string, idx: number) => (
                  <li key={idx} className="line-clamp-2">{h}</li>
                ))}
              </ul>
            </div>

            {/* Motifs Majeurs */}
            <div className="rounded-2xl border border-mist-200 bg-white/90 p-3.5 space-y-2 shadow-sm">
              <span className="font-bold text-sun-700 flex items-center gap-1.5 text-[11.5px]">
                <span>🔍</span>
                <span>Motifs de Contact Principaux</span>
              </span>
              <ul className="space-y-1.5 text-[11px] text-ink-700 list-disc list-inside leading-relaxed">
                {(briefing.topMotives || []).map((m: string, idx: number) => (
                  <li key={idx} className="line-clamp-2">{m}</li>
                ))}
              </ul>
            </div>

            {/* Actions Recommandées */}
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/50 p-3.5 space-y-2 shadow-sm sm:col-span-2 lg:col-span-1">
              <span className="font-bold text-emerald-800 flex items-center gap-1.5 text-[11.5px]">
                <span>🚀</span>
                <span>3 Actions Recommandées</span>
              </span>
              <ul className="space-y-1.5 text-[11px] text-emerald-950 list-disc list-inside leading-relaxed font-medium">
                {(briefing.recommendedActions || []).map((a: string, idx: number) => (
                  <li key={idx} className="line-clamp-2">{a}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-400 italic py-2">
            Chargement de la synthèse managériale en cours…
          </p>
        )}
      </div>

      {/* Cartes KPI Principales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total conversations"
          value={totals.conversations.toLocaleString('fr-FR')}
          trend={{
            ...delta(totals.conversations, previous.conversations),
            goodDirection: 'up'
          }}
          subtext={`vs période précédente (${previous.conversations})`}
        />
        <StatTile
          label="Résolues 100% par le Bot"
          value={`${botResolutionRate} %`}
          subtext={`${totals.bot_only} discussions sans intervention humaine`}
        />
        <StatTile
          label="Escaladées à un Conseiller"
          value={totals.escalated.toLocaleString('fr-FR')}
          trend={{
            ...delta(totals.escalated, previous.escalated),
            goodDirection: 'down'
          }}
          subtext={`${pct(totals.escalated, totals.conversations)} % du volume total`}
        />
        <StatTile
          label="Satisfaction Visiteurs (CSAT)"
          value={totalFeedback > 0 ? `${pct(totals.feedback_up, totalFeedback)} %` : '—'}
          subtext={`${totals.feedback_up} avis positifs sur ${totalFeedback} votes`}
        />
      </div>

      {/* ── SECTION NOUVELLE : Analyse des Intentions de Contact IA ──────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-ink flex items-center gap-2">
              <span>🧠</span>
              <span>Intentions & Causes de Contact (Analyse IA)</span>
            </h2>
            <p className="text-xs text-ink-500">
              Répartition des motifs de sollicitation analysés automatiquement sur {totals.conversations} conversations.
            </p>
          </div>
        </div>

        {/* Barre de répartition proportionnelle des motifs */}
        <Card className="p-4">
          <p className="text-xs font-medium text-ink-500 mb-2">Répartition proportionnelle des causes de contact</p>
          <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-mist-200">
            {intents.map((it, idx) => (
              <div
                key={it.id}
                className={cn(it.colorClass, idx > 0 && 'ml-0.5')}
                style={{ width: `${Math.max(1, it.percentage)}%` }}
                title={`${it.label} : ${it.count} conversations (${it.percentage} %)`}
              />
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {intents.map((it) => (
              <div
                key={it.id}
                className="flex items-center justify-between rounded-xl border border-mist-200 bg-mist-50/60 p-2.5 transition hover:bg-mist-100/70"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{it.icon}</span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink">{it.label}</p>
                    <p className="text-[10.5px] text-ink-400">{it.category}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-ink">{it.percentage} %</span>
                  <p className="text-[10px] text-ink-400">{it.count} conv.</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Tableau détaillé des intentions */}
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-mist-200 bg-mist-50/80 text-ink-500 font-semibold">
                <tr>
                  <th className="px-4 py-3">Motif de Contact</th>
                  <th className="px-4 py-3">Volume & Part</th>
                  <th className="px-4 py-3">Résolution Bot Lumi</th>
                  <th className="px-4 py-3">Escalade Conseiller</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist-200 text-ink">
                {intents.map((it) => (
                  <tr key={it.id} className="hover:bg-mist-50/50 transition">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <span>{it.icon}</span>
                        <div>
                          <span className="font-semibold text-ink">{it.label}</span>
                          <span className={cn('ml-2 inline-block rounded-md border px-1.5 py-0.5 text-[9.5px]', it.badgeClass)}>
                            {it.category}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink w-10">{it.percentage} %</span>
                        <div className="h-1.5 w-16 rounded-full bg-mist-200 overflow-hidden">
                          <div className={cn('h-full', it.colorClass)} style={{ width: `${it.percentage}%` }} />
                        </div>
                        <span className="text-ink-400 text-[11px]">({it.count})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-lagoon-600">{it.botResolutionRate} %</span>
                      <span className="ml-1 text-ink-400 text-[11px]">({it.botOnlyCount} conv.)</span>
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      <span>{it.escalatedCount} conv.</span>
                      <span className="ml-1 text-ink-400 text-[11px]">({pct(it.escalatedCount, it.count || 1)} %)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Graphiques Complémentaires */}
      <div className="grid gap-4 md:grid-cols-2">
        <SplitBar
          title="Répartition Traitement Bot vs Conseiller Humain"
          segments={[
            {
              label: '100% Autonome Lumi',
              value: totals.bot_only,
              colorClass: 'bg-aurora-500',
              textClass: 'text-aurora-600'
            },
            {
              label: 'Relayé par Conseiller',
              value: totals.escalated,
              colorClass: 'bg-lagoon-600',
              textClass: 'text-lagoon-700'
            }
          ]}
        />
        <SplitBar
          title="Évaluations Visiteurs (Satisfaction)"
          segments={[
            {
              label: 'Utile (👍)',
              value: totals.feedback_up,
              colorClass: 'bg-lagoon-600',
              textClass: 'text-lagoon-700'
            },
            {
              label: 'Non utile (👎)',
              value: totals.feedback_down,
              colorClass: 'bg-coral-500',
              textClass: 'text-coral-600'
            }
          ]}
        />
      </div>

      {/* Volume quotidien */}
      <DailyBarChart daily={daily} />
    </div>
  );
}
