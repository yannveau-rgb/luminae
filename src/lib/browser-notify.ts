// Notifications navigateur (Notification API) + alertes sonores haute fidélité (Web Audio API).
// Fonctionne 100% côté client sans nécessiter de fichiers audio externes hébergés.

export function notificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | null {
  return notificationSupported() ? Notification.permission : null;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (!notificationSupported()) return null;
  return Notification.requestPermission();
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  try {
    return new Ctx();
  } catch {
    return null;
  }
}

/**
 * Son de notification Agent (Conseiller) :
 * Carillon net et pro en deux tons montants (E5 -> B5).
 */
export function playAgentNotificationSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  [659.25, 987.77].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.10;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.16, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.20);
  });

  setTimeout(() => ctx.close().catch(() => {}), 600);
}

/**
 * Son de réponse Visiteur (Widget) :
 * Carillon chaleureux et soyeux en trois notes harmoniques (F5 -> A5 -> C6).
 */
export function playVisitorMessageSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  [698.46, 880.0, 1046.5].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.08;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.14, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.18);
  });

  setTimeout(() => ctx.close().catch(() => {}), 600);
}

/** Rétrocompatibilité */
export const playNotificationSound = playAgentNotificationSound;

export function showBrowserNotification(params: {
  title: string;
  body?: string | null;
  onClick?: () => void;
}) {
  if (!notificationSupported() || Notification.permission !== 'granted') return;
  const notif = new Notification(params.title, {
    body: params.body ?? undefined,
    tag: 'luminae-notification'
  });
  notif.onclick = () => {
    window.focus();
    params.onClick?.();
    notif.close();
  };
  setTimeout(() => notif.close(), 8000);
}
