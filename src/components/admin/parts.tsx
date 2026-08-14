'use client';

/** Petits éléments partagés du back-office haute précision. */

import { cn } from '@/lib/utils';

/** Styles d'input uniformes avec focus ring doux. */
export const inputCls =
  'w-full rounded-xl border border-mist-300 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-lagoon-400 focus:ring-2 focus:ring-lagoon-400/20 placeholder:text-ink-300';

export function SectionHeader({
  title,
  description,
  badge
}: {
  title: string;
  description?: string;
  badge?: string;
}) {
  return (
    <header className="mb-6">
      <div className="flex items-center gap-2.5">
        <h1 className="font-display text-xl font-bold tracking-tight text-ink">{title}</h1>
        {badge && (
          <span className="rounded-md bg-aurora-100 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-lagoon-700">
            {badge}
          </span>
        )}
      </div>
      {description && <p className="mt-1 text-xs leading-relaxed text-ink-500">{description}</p>}
    </header>
  );
}

export function Field({
  label,
  hint,
  children,
  required
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="block text-xs font-semibold text-ink-700">
          {label} {required && <span className="text-coral-500">*</span>}
        </span>
      </div>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] text-ink-400 leading-normal">{hint}</span>}
    </label>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-mist-300/80 bg-white p-5 md:p-6 shadow-panel', className)}>
      {children}
    </div>
  );
}

export function SaveButton({ busy, label = 'Enregistrer les modifications' }: { busy: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-lagoon-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:bg-lagoon-500 disabled:opacity-50"
    >
      {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
      <span>{busy ? 'Enregistrement en cours…' : label}</span>
    </button>
  );
}

export function FormNotice({ kind, text }: { kind: 'ok' | 'error' | 'warn'; text: string | null }) {
  if (!text) return null;
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium border animate-fade-in',
        kind === 'ok' && 'border-lagoon-300 bg-lagoon-50 text-lagoon-700',
        kind === 'error' && 'border-coral-300 bg-coral-50 text-coral-600',
        kind === 'warn' && 'border-sun-300 bg-sun-50 text-sun-700'
      )}
    >
      <span>{kind === 'ok' ? '✓' : kind === 'error' ? '⚠️' : 'ℹ️'}</span>
      <span>{text}</span>
    </div>
  );
}