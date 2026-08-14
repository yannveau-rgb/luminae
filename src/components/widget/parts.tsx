'use client';

/** Éléments visuels haut de gamme du widget public — orbe signature du bot, indicateurs, avatars, boutons. */

import { cn } from '@/lib/utils';

export function BotOrb({
  size = 40,
  accent = 'var(--accent)',
  glow = true
}: {
  size?: number;
  accent?: string;
  glow?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative shrink-0 rounded-full transition-transform',
        glow ? 'shadow-halo animate-halo-breathe' : 'shadow-sm'
      )}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${accent} 45%, white), ${accent} 62%, color-mix(in srgb, ${accent} 78%, #081624))`
      }}
    >
      <svg
        viewBox="0 0 24 24"
        className="absolute inset-0 m-auto"
        style={{ width: size * 0.52, height: size * 0.52 }}
        fill="none"
      >
        <path
          d="M12 3.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5Z"
          fill="white"
          opacity="0.95"
        />
        <circle cx="18" cy="17.5" r="1.6" fill="white" opacity="0.8" />
      </svg>
    </div>
  );
}

export function AgentAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-lagoon-600 to-lagoon-700 font-display font-bold text-white shadow-sm ring-1 ring-black/5"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || '?'}
    </div>
  );
}

export function TypingDots({ accent = 'var(--accent)' }: { accent?: string }) {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5" aria-label="L’assistant est en train d’écrire">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="animate-dot-pulse inline-block h-2 w-2 rounded-full"
          style={{ background: accent, animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </div>
  );
}

/** Puce de question suggérée (état vide engageant). */
export function SuggestionChip({
  label,
  icon,
  onPick
}: {
  label: string;
  icon?: string;
  onPick: (label: string) => void;
}) {
  return (
    <button
      onClick={() => onPick(label)}
      className="animate-fade-in flex items-center gap-2 rounded-xl border border-mist-300 bg-white/90 px-3.5 py-2 text-left text-xs font-semibold text-ink-700 shadow-sm backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:border-lagoon-300 hover:bg-lagoon-50/60 hover:text-lagoon-700 hover:shadow-glow-sm"
    >
      {icon && <span className="text-sm">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}

export function SendIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  );
}

export function ThumbIcon({ up, filled }: { up: boolean; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
      {up ? (
        <path d="M7 10v12H4a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h3Zm0 0 4.2-7.4A1.8 1.8 0 0 1 14.5 3c.8.8 1.1 2 .7 3.1L14.2 9H19a2 2 0 0 1 2 2.4l-1.5 8A2 2 0 0 1 17.5 21H7" />
      ) : (
        <path d="M17 14V2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-3Zm0 0-4.2 7.4a1.8 1.8 0 0 1-3.3-.4 3.2 3.2 0 0 1-.7-3.1L9.8 15H5a2 2 0 0 1-2-2.4l1.5-8A2 2 0 0 1 6.5 3H17" />
      )}
    </svg>
  );
}

export function HumanIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </svg>
  );
}
