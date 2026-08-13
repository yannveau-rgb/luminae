// Notifications navigateur (Notification API) + son, pour la boîte de réception agent.
// Ne déclenche rien côté serveur : purement client, en complément du centre in-app existant.

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

/** Bip discret en deux notes, généré via Web Audio (pas de fichier audio à héberger). */
export function playNotificationSound() {
  if (typeof window === 'undefined') return;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const now = ctx.currentTime;

  [880, 1108].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.11;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.18);
  });

  setTimeout(() => ctx.close().catch(() => {}), 500);
}

export function showBrowserNotification(params: { title: string; body?: string | null; onClick?: () => void }) {
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
