'use client';

/** Éléments visuels du widget — orbe signature du bot, indicateurs, avatars. */

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
      className={`relative shrink-0 rounded-full ${glow ? 'animate-halo-breathe' : ''}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${accent} 45%, white), ${accent} 62%, color-mix(in srgb, ${accent} 78%, #081624))`
      }}
    >
      {/* Étincelle centrale */}
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
      className="flex shrink-0 items-center justify-center rounded-full bg-ink-700 font-display font-semibold text-white"
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
export function SuggestionChip({ label, onPick }: { label: string; onPick: (label: string) => void }) {
  return (
    <button
      onClick={() => onPick(label)}
      className="animate-fade-in rounded-full border px-3.5 py-2 text-left text-[13px] font-medium transition hover:-translate-y-px"
      style={{
        borderColor: 'color-mix(in srgb, var(--accent) 35%, white)',
        background: 'color-mix(in srgb, var(--accent) 7%, white)',
        color: 'color-mix(in srgb, var(--accent) 75%, #0F2233)'
      }}
    >
      {label}
    </button>
  );
}

export function SendIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
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
