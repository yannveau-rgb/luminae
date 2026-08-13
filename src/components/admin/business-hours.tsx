'use client';

/** Horaires d'ouverture : fuseau, créneaux hebdomadaires, jours fériés. */

import { useEffect, useState } from 'react';
import { Card, Field, FormNotice, SaveButton, SectionHeader, inputCls } from './parts';
import { cn } from '@/lib/utils';

type Weekly = Record<string, [string, string][]>;

const DAYS = [
  ['monday', 'Lundi'],
  ['tuesday', 'Mardi'],
  ['wednesday', 'Mercredi'],
  ['thursday', 'Jeudi'],
  ['friday', 'Vendredi'],
  ['saturday', 'Samedi'],
  ['sunday', 'Dimanche']
] as const;

const TIMEZONES = [
  'Europe/Paris',
  'Europe/Brussels',
  'Europe/London',
  'Europe/Lisbon',
  'Europe/Madrid',
  'Europe/Zurich',
  'Africa/Casablanca',
  'America/Montreal',
  'America/New_York',
  'UTC'
];

export function BusinessHoursForm() {
  const [timezone, setTimezone] = useState('Europe/Paris');
  const [weekly, setWeekly] = useState<Weekly>({});
  const [holidays, setHolidays] = useState<{ date: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [hDate, setHDate] = useState('');
  const [hName, setHName] = useState('');

  useEffect(() => {
    fetch('/api/admin/business-hours', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((j) => {
        setTimezone(j.hours.timezone);
        setWeekly((j.hours.weekly as Weekly) ?? {});
        setHolidays((j.hours.holidays as { date: string; name: string }[]) ?? []);
      })
      .catch(() => setNotice({ kind: 'error', text: 'Impossible de charger les horaires.' }));
  }, []);

  function setSlots(day: string, slots: [string, string][]) {
    setWeekly((w) => ({ ...w, [day]: slots }));
  }

  function addHoliday() {
    if (!hDate) return;
    setHolidays((list) =>
      [...list.filter((h) => h.date !== hDate), { date: hDate, name: hName.trim() || 'Jour férié' }].sort((a, b) =>
        a.date.localeCompare(b.date)
      )
    );
    setHDate('');
    setHName('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await fetch('/api/admin/business-hours', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone, weekly, holidays })
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) setNotice({ kind: 'ok', text: 'Horaires enregistrés.' });
    else setNotice({ kind: 'error', text: j.error ?? 'La sauvegarde a échoué.' });
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <SectionHeader
        title="Horaires d’ouverture"
        description="Utilisés pour l’escalade : hors horaires, le bot informe les visiteurs du délai d’attente."
      />
      <div className="space-y-5">
        <Card>
          <Field label="Fuseau horaire" hint="Format IANA, ex. Europe/Paris.">
            <input className={inputCls} list="tz-list" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            <datalist id="tz-list">
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          </Field>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold">Créneaux hebdomadaires</h2>
          <div className="space-y-3">
            {DAYS.map(([key, label]) => {
              const slots = weekly[key] ?? [];
              const open = slots.length > 0;
              return (
                <div key={key} className="flex flex-wrap items-center gap-2 border-b border-mist-300/60 pb-3 last:border-0 last:pb-0">
                  <label className="flex w-28 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={open}
                      onChange={(e) => setSlots(key, e.target.checked ? [['09:00', '12:00']] : [])}
                      className="h-4 w-4 accent-lagoon-600"
                    />
                    <span className={cn(open ? 'font-medium text-ink' : 'text-ink-400')}>{label}</span>
                  </label>
                  {open && (
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      {slots.map(([start, end], i) => (
                        <div key={i} className="flex items-center gap-1">
                          <input
                            type="time"
                            value={start}
                            onChange={(e) => setSlots(key, slots.map((s, j) => (j === i ? [e.target.value, s[1]] : s)))}
                            className="rounded-lg border border-mist-300 px-2 py-1.5 text-sm"
                          />
                          <span className="text-ink-400">–</span>
                          <input
                            type="time"
                            value={end}
                            onChange={(e) => setSlots(key, slots.map((s, j) => (j === i ? [s[0], e.target.value] : s)))}
                            className="rounded-lg border border-mist-300 px-2 py-1.5 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setSlots(key, slots.filter((_, j) => j !== i))}
                            className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-ink-400 transition hover:bg-coral-50 hover:text-coral-600"
                            title="Retirer ce créneau"
                            aria-label="Retirer ce créneau"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSlots(key, [...slots, ['14:00', '18:00']])}
                        className="rounded-full border border-mist-300 px-2.5 py-1 text-xs font-medium text-ink-500 transition hover:border-lagoon-300 hover:text-lagoon-700"
                      >
                        + Créneau
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold">Jours fériés</h2>
          <div className="flex items-end gap-2">
            <Field label="Date">
              <input type="date" className={inputCls} value={hDate} onChange={(e) => setHDate(e.target.value)} />
            </Field>
            <Field label="Nom (optionnel)">
              <input className={inputCls} value={hName} onChange={(e) => setHName(e.target.value)} placeholder="Noël" />
            </Field>
            <button
              type="button"
              onClick={addHoliday}
              disabled={!hDate}
              className="h-[42px] shrink-0 rounded-xl border border-lagoon-300 px-4 text-sm font-medium text-lagoon-700 transition hover:bg-lagoon-50 disabled:opacity-40"
            >
              Ajouter
            </button>
          </div>
          {holidays.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {holidays.map((h) => (
                <li key={h.date} className="flex items-center justify-between rounded-lg bg-mist px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{h.date}</span>
                    <span className="ml-2 text-ink-500">{h.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setHolidays((list) => list.filter((x) => x.date !== h.date))}
                    className="text-ink-400 transition hover:text-coral-600"
                    title="Retirer"
                    aria-label="Retirer ce jour férié"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <SaveButton busy={busy} />
        <FormNotice kind={notice?.kind ?? 'ok'} text={notice?.text ?? null} />
      </div>
    </form>
  );
}