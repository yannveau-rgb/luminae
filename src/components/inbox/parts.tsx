'use client';

/** Petits éléments partagés de la boîte de réception agent. */

import { cn, formatDay, initials } from '@/lib/utils';
import type { ConversationStatus } from '@/lib/types';

const STATUS_STYLES: Record<ConversationStatus, string> = {
  bot: 'bg-aurora-100 text-aurora-600',
  waiting: 'bg-sun-100 text-sun-600',
  assigned: 'bg-lagoon-100 text-lagoon-700',
  resolved: 'bg-mist text-ink-500'
};

const STATUS_TEXT: Record<ConversationStatus, string> = {
  bot: 'Bot',
  waiting: 'En attente',
  assigned: 'Assignée',
  resolved: 'Résolue'
};

export function StatusBadge({ status, className }: { status: ConversationStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        STATUS_STYLES[status] ?? STATUS_STYLES.resolved,
        className
      )}
    >
      {STATUS_TEXT[status] ?? status}
    </span>
  );
}

export function Avatar({
  name,
  url,
  size = 32,
  className
}: {
  name: string | null;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size };
  if (url) {
    return <img src={url} alt={name ?? 'Avatar'} style={style} className={cn('shrink-0 rounded-full object-cover', className)} />;
  }
  return (
    <div
      style={style}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-ink-700 font-display text-white',
        className
      )}
    >
      <span style={{ fontSize: Math.max(10, size * 0.38) }}>{initials(name)}</span>
    </div>
  );
}

export function DayDivider({ iso }: { iso: string }) {
  return (
    <div className="my-3 flex items-center gap-3" role="separator">
      <div className="h-px flex-1 bg-mist-300" />
      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{formatDay(iso)}</span>
      <div className="h-px flex-1 bg-mist-300" />
    </div>
  );
}

export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1.5 text-[11px] font-semibold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}