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

let sharedAudioContext: AudioContext | null = null;

function getSharedContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedAudioContext) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        sharedAudioContext = new Ctx();
      }
    }
    if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

// Déverrouillage automatique au premier geste utilisateur
if (typeof window !== 'undefined') {
  const unlock = () => {
    getSharedContext();
  };
  ['click', 'keydown', 'touchstart', 'pointerdown'].forEach((evt) => {
    window.addEventListener(evt, unlock, { once: true, passive: true });
  });
}

/**
 * Son de notification Agent (Conseiller) :
 * Carillon net, brillant et pro en deux tons montants (E5 659Hz -> B5 987Hz).
 */
export function playAgentNotificationSound() {
  const ctx = getSharedContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    [659.25, 987.77].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      const start = now + i * 0.11;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  } catch (err) {
    console.error('[Audio] Erreur lecture carillon agent:', err);
  }
}

/**
 * Son de réponse Visiteur (Widget) :
 * Carillon soyeux et chaleureux en trois notes harmoniques (F5 -> A5 -> C6).
 */
export function playVisitorMessageSound() {
  const ctx = getSharedContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    [698.46, 880.0, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      const start = now + i * 0.09;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.22);
    });
  } catch (err) {
    console.error('[Audio] Erreur lecture carillon visiteur:', err);
  }
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
