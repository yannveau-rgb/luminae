import type { AgentAbsence, BusinessHours } from './types';
import { supabaseAdmin } from './supabase/admin';

/**
 * Horaires d'ouverture & disponibilités.
 * Calculs dans le fuseau horaire configuré, via Intl (pas de dépendance).
 */

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const DAY_LABELS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const;

interface ZonedParts {
  weekdayIndex: number;
  minutes: number;
  dateStr: string; // YYYY-MM-DD
}

/** Décompose l'instant présent dans un fuseau horaire IANA. */
export function zonedParts(timeZone: string, date: Date = new Date()): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
  };
  const hour = parseInt(get('hour'), 10) % 24;
  return {
    weekdayIndex: weekdayMap[get('weekday')] ?? 0,
    minutes: hour * 60 + parseInt(get('minute'), 10),
    dateStr: `${get('year')}-${get('month')}-${get('day')}`
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((v) => parseInt(v, 10));
  return (h || 0) * 60 + (m || 0);
}

/** L'équipe est-elle dans un créneau d'ouverture (hors jours fériés) ? */
export function isOpenNow(hours: BusinessHours, date: Date = new Date()): boolean {
  const z = zonedParts(hours.timezone, date);
  const holiday = (hours.holidays || []).find((h) => h.date === z.dateStr);
  if (holiday) return false;
  const slots = hours.weekly?.[DAY_KEYS[z.weekdayIndex]] ?? [];
  return slots.some(([start, end]) => z.minutes >= toMinutes(start) && z.minutes < toMinutes(end));
}

/** Prochaine ouverture sous 14 jours : { dayLabel, time } ou null. */
export function nextOpening(hours: BusinessHours): { dayLabel: string; time: string } | null {
  const now = Date.now();
  for (let i = 0; i < 14; i++) {
    const date = new Date(now + i * 86400000);
    const z = zonedParts(hours.timezone, date);
    const isHoliday = (hours.holidays || []).some((h) => h.date === z.dateStr);
    if (isHoliday) continue;
    const slots = hours.weekly?.[DAY_KEYS[z.weekdayIndex]] ?? [];
    for (const [start, end] of slots) {
      if (i === 0 && z.minutes >= toMinutes(end)) continue;
      if (i === 0 && z.minutes >= toMinutes(start) && z.minutes < toMinutes(end)) return null; // déjà ouvert
      const dayLabel = i === 0 ? 'aujourd’hui' : i === 1 ? 'demain' : DAY_LABELS_FR[z.weekdayIndex];
      return { dayLabel, time: start };
    }
  }
  return null;
}

/** Phrase d'attente humaine, adaptée aux horaires. */
export function offlineWaitPhrase(hours: BusinessHours): string {
  const next = nextOpening(hours);
  if (!next) return 'Nous vous répondrons dès que possible.';
  return `L’équipe sera de retour ${next.dayLabel} à ${next.time}.`;
}

export function isAgentAbsent(absences: AgentAbsence[], at: Date = new Date()): boolean {
  const t = at.getTime();
  return absences.some(
    (a) => new Date(a.starts_at).getTime() <= t && t < new Date(a.ends_at).getTime()
  );
}

/**
 * Un agent est « disponible » si :
 *  - il n'est pas en absence déclarée,
 *  - l'équipe est dans ses horaires d'ouverture.
 * (Utilisé pour savoir si une escalade peut être traitée immédiatement.)
 */
export async function teamAvailability(): Promise<{
  open: boolean;
  availableAgents: string[]; // ids des agents disponibles
  waitPhrase: string;
}> {
  const db = supabaseAdmin();
  const [{ data: hoursRow }, { data: agents }, { data: absences }] = await Promise.all([
    db.from('business_hours').select('*').eq('id', 1).maybeSingle(),
    db.from('agents').select('id').in('role', ['admin', 'agent']),
    db.from('agent_absences').select('*')
  ]);

  const hours: BusinessHours = (hoursRow as unknown as BusinessHours | null) ?? {
    timezone: 'Europe/Paris',
    weekly: {},
    holidays: []
  };
  const open = isOpenNow(hours);
  const agentAbsences = (absences ?? []) as AgentAbsence[];
  const availableAgents = open
    ? (agents ?? [])
        .map((a) => a.id as string)
        .filter((id) => !isAgentAbsent(agentAbsences.filter((ab) => ab.agent_id === id)))
    : [];

  return { open, availableAgents, waitPhrase: offlineWaitPhrase(hours) };
}
