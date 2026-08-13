'use client';

/** Petits éléments partagés du back-office. */

import { cn } from '@/lib/utils';

/** Styles d'input uniformes. */
export const inputCls =
  'w-full rounded-xl border border-mist-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-lagoon-400';

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-6">
      <h1 className="font-display text-xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
    </header>
  );
}

export function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>}
    </label>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl bg-white p-5 shadow-panel', className)}>{children}</div>;
}

export function SaveButton({ busy, label = 'Enregistrer' }: { busy: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="rounded-xl bg-lagoon-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-lagoon-700 disabled:opacity-50"
    >
      {busy ? 'Enregistrement…' : label}
    </button>
  );
}

export function FormNotice({ kind, text }: { kind: 'ok' | 'error' | 'warn'; text: string | null }) {
  if (!text) return null;
  return (
    <p
      className={cn(
        'rounded-lg px-3 py-2 text-xs',
        kind === 'ok' && 'bg-lagoon-100 text-lagoon-700',
        kind === 'error' && 'bg-coral-50 text-coral-600',
        kind === 'warn' && 'bg-sun-50 text-sun-600'
      )}
    >
      {text}
    </p>
  );
}