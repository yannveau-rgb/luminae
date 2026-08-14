'use client';

/** Configuration du routage et de la distribution des conversations (Freshchat style). */

import { useEffect, useState } from 'react';
import { Card, Field, FormNotice, SaveButton, SectionHeader, inputCls } from './parts';

export interface RoutingSettings {
  mode: 'round_robin' | 'load_balanced' | 'manual';
  max_concurrency: number;
  auto_reassign_minutes: number;
  offline_handling: 'queue' | 'bot_only' | 'close';
  notify_on_queue: boolean;
}

const DEFAULT_ROUTING: RoutingSettings = {
  mode: 'load_balanced',
  max_concurrency: 5,
  auto_reassign_minutes: 10,
  offline_handling: 'queue',
  notify_on_queue: true
};

export function RoutingPanel() {
  const [settings, setSettings] = useState<RoutingSettings>(DEFAULT_ROUTING);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/advanced-settings?section=routing', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((j) => {
        if (j.routing) setSettings(j.routing);
      })
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await fetch('/api/admin/advanced-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'routing', data: settings })
    });
    if (res.ok) {
      setNotice({ kind: 'ok', text: 'Règles de routage enregistrées avec succès.' });
    } else {
      setNotice({ kind: 'error', text: 'Impossible d’enregistrer le routage.' });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <SectionHeader
        title="Routage & Distribution Intelligente"
        description="Configurez l'affectation automatique des conversations escaladées entre vos conseillers selon leur disponibilité et leur charge de travail."
      />

      <div className="space-y-5">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink">Mode de Distribution</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                id: 'load_balanced',
                title: 'Équilibrage de charge',
                badge: 'Recommandé',
                desc: 'Attribue en priorité à l’agent ayant le moins de discussions actives.'
              },
              {
                id: 'round_robin',
                title: 'Tour de rôle (Round-Robin)',
                desc: 'Rotation équitable et séquentielle entre tous les agents connectés.'
              },
              {
                id: 'manual',
                title: 'File manuelle',
                desc: 'Les conversations restent non assignées jusqu’à ce qu’un agent s’en empare.'
              }
            ].map((m) => {
              const selected = settings.mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, mode: m.id as RoutingSettings['mode'] }))}
                  className={`flex flex-col rounded-xl border p-4 text-left transition ${
                    selected
                      ? 'border-lagoon-600 bg-lagoon-50 ring-2 ring-lagoon-500/20'
                      : 'border-mist-300 bg-white hover:border-mist-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">{m.title}</span>
                    {m.badge && (
                      <span className="rounded-full bg-lagoon-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-ink-500">{m.desc}</p>
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink">Capacité & Temporisation</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Capacité maximale par agent (Concurrency limit)"
              hint="Nombre max de conversations simultanées actives par conseiller."
            >
              <input
                type="number"
                min={1}
                max={30}
                className={inputCls}
                value={settings.max_concurrency}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, max_concurrency: Number(e.target.value) || 5 }))
                }
              />
            </Field>

            <Field
              label="Délai de réassignation automatique (minutes)"
              hint="Réassigne au collègue suivant si l'agent n'a pas répondu sous ce délai."
            >
              <select
                className={inputCls}
                value={settings.auto_reassign_minutes}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, auto_reassign_minutes: Number(e.target.value) }))
                }
              >
                <option value={0}>Désactivé (jamais)</option>
                <option value={3}>Après 3 minutes</option>
                <option value={5}>Après 5 minutes</option>
                <option value={10}>Après 10 minutes</option>
                <option value={15}>Après 15 minutes</option>
              </select>
            </Field>

            <Field
              label="Gestion des flux hors horaires d'ouverture"
              hint="Comportement quand tous les agents sont absents ou fermés."
            >
              <select
                className={inputCls}
                value={settings.offline_handling}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    offline_handling: e.target.value as RoutingSettings['offline_handling']
                  }))
                }
              >
                <option value="queue">Mettre en attente (avec message d’indisponibilité)</option>
                <option value="bot_only">Géré exclusivement par le bot Lumi</option>
                <option value="close">Fermer la saisie visiteur</option>
              </select>
            </Field>

            <div className="sm:col-span-2 pt-2">
              <label className="flex items-center gap-2.5 text-xs font-medium text-ink">
                <input
                  type="checkbox"
                  checked={settings.notify_on_queue}
                  onChange={(e) => setSettings((s) => ({ ...s, notify_on_queue: e.target.checked }))}
                  className="h-4 w-4 rounded border-mist-300 accent-lagoon-600"
                />
                Envoyer une alerte sonore et push à l&apos;équipe lorsqu&apos;une conversation entre en file d&apos;attente
              </label>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <SaveButton busy={busy} />
        <FormNotice kind={notice?.kind ?? 'ok'} text={notice?.text ?? null} />
      </div>
    </form>
  );
}
