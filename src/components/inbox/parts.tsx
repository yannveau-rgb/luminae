'use client';

/** Petits éléments partagés de la boîte de réception agent haute performance. */

import { cn, formatDay, initials } from '@/lib/utils';
import type { ConversationStatus } from '@/lib/types';

const STATUS_STYLES: Record<ConversationStatus, string> = {
  bot: 'bg-aurora-100/80 text-aurora-600 border border-aurora-300/60',
  waiting: 'bg-sun-100/80 text-sun-600 border border-sun-300/60',
  assigned: 'bg-lagoon-100/80 text-lagoon-700 border border-lagoon-300/60',
  resolved: 'bg-mist-200 text-ink-500 border border-mist-300'
};

const STATUS_TEXT: Record<ConversationStatus, string> = {
  bot: 'Bot RAG',
  waiting: 'En attente',
  assigned: 'Assignée',
  resolved: 'Résolue'
};

export function StatusBadge({ status, className }: { status: ConversationStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold transition',
        STATUS_STYLES[status] ?? STATUS_STYLES.resolved,
        className
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full shrink-0',
          status === 'bot' && 'bg-aurora-500 animate-pulse',
          status === 'waiting' && 'bg-sun-500',
          status === 'assigned' && 'bg-lagoon-500',
          status === 'resolved' && 'bg-ink-400'
        )}
      />
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
    return (
      <img
        src={url}
        alt={name ?? 'Avatar'}
        style={style}
        className={cn('shrink-0 rounded-full object-cover ring-1 ring-black/5', className)}
      />
    );
  }
  return (
    <div
      style={style}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ink-700 to-ink-900 font-display font-bold text-white shadow-sm',
        className
      )}
    >
      <span style={{ fontSize: Math.max(10, size * 0.38) }}>{initials(name)}</span>
    </div>
  );
}

export function DayDivider({ iso }: { iso: string }) {
  return (
    <div className="my-4 flex items-center gap-3" role="separator">
      <div className="h-px flex-1 bg-mist-300/80" />
      <span className="rounded-full border border-mist-300 bg-white px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-400 shadow-sm">
        {formatDay(iso)}
      </span>
      <div className="h-px flex-1 bg-mist-300/80" />
    </div>
  );
}

export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-coral-500 px-1 text-[10px] font-bold text-white shadow-glow-sm">
      {count > 99 ? '99+' : count}
    </span>
  );
}