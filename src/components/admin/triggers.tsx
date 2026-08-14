'use client';

/** Gestionnaire des messages proactifs et déclencheurs ciblés (Freshchat / Intercom style). */

import { useEffect, useState } from 'react';
import { Card, Field, FormNotice, SaveButton, SectionHeader, inputCls } from './parts';

export interface ProactiveTrigger {
  id: string;
  name: string;
  url_pattern: string;
  delay_seconds: number;
  message: string;
  enabled: boolean;
}

const DEFAULT_TRIGGERS: ProactiveTrigger[] = [
  {
    id: 'trg_pricing',
    name: 'Assistance Page Tarifs',
    url_pattern: '/tarifs',
    delay_seconds: 12,
    message: 'Bonjour ! Avez-vous une question sur nos forfaits ou sur le déploiement sur-mesure ?',
    enabled: true
  },
  {
    id: 'trg_demo',
    name: 'Aide à la réservation de démo',
    url_pattern: '/demo',
    delay_seconds: 8,
    message: 'Besoin d’aide pour planifier votre créneau avec notre équipe d’experts ?',
    enabled: true
  }
];

export function TriggersPanel() {
  const [triggers, setTriggers] = useState<ProactiveTrigger[]>(DEFAULT_TRIGGERS);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/advanced-settings?section=triggers', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((j) => {
        if (Array.isArray(j.triggers)) setTriggers(j.triggers);
      })
      .catch(() => {});
  }, []);

  function addTrigger() {
    const newTrg: ProactiveTrigger = {
      id: `trg_${Date.now()}`,
      name: 'Nouveau message proactif',
      url_pattern: '/',
      delay_seconds: 10,
      message: 'Bonjour ! Comment pouvons-nous vous aider aujourd’hui ?',
      enabled: true
    };
    setTriggers((prev) => [...prev, newTrg]);
  }

  function removeTrigger(id: string) {
    setTriggers((prev) => prev.filter((t) => t.id !== id));
  }

  function updateTrigger(id: string, patch: Partial<ProactiveTrigger>) {
    setTriggers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await fetch('/api/admin/advanced-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'triggers', data: triggers })
    });
    if (res.ok) {
      setNotice({ kind: 'ok', text: 'Campagnes proactives enregistrées avec succès.' });
    } else {
      setNotice({ kind: 'error', text: 'Impossible d’enregistrer les déclencheurs.' });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <SectionHeader
          title="Messages Proactifs & Campagnes"
          description="Engagez automatiquement vos visiteurs avec un message contextualisé selon la page qu'ils consultent et leur temps passé."
        />
        <button
          type="button"
          onClick={addTrigger}
          className="self-start rounded-xl bg-ink-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-ink-800 transition"
        >
          + Ajouter une règle
        </button>
      </div>

      <div className="space-y-4">
        {triggers.map((t, idx) => (
          <Card key={t.id} className="relative border border-mist-300">
            <div className="flex items-center justify-between pb-3 border-b border-mist-200">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-mist-100 text-xs font-bold text-ink">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  value={t.name}
                  onChange={(e) => updateTrigger(t.id, { name: e.target.value })}
                  placeholder="Nom de la campagne"
                  className="text-xs font-bold text-ink bg-transparent outline-none border-b border-transparent focus:border-lagoon-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-ink-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={t.enabled}
                    onChange={(e) => updateTrigger(t.id, { enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-mist-300 accent-lagoon-600"
                  />
                  <span>{t.enabled ? 'Actif' : 'Désactivé'}</span>
                </label>
                <button
                  type="button"
                  onClick={() => removeTrigger(t.id)}
                  className="rounded-lg p-1 text-mist-400 hover:bg-coral-50 hover:text-coral-600 transition"
                  title="Supprimer cette campagne"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Page cible (URL ou chemin)"
                hint="Ex: /tarifs, /contact ou * pour toutes les pages."
              >
                <input
                  type="text"
                  className={inputCls}
                  value={t.url_pattern}
                  onChange={(e) => updateTrigger(t.id, { url_pattern: e.target.value })}
                  placeholder="/tarifs"
                />
              </Field>

              <Field
                label="Délai d'apparition (secondes)"
                hint="Temps d'attente sur la page avant d'ouvrir la bulle."
              >
                <input
                  type="number"
                  min={1}
                  max={300}
                  className={inputCls}
                  value={t.delay_seconds}
                  onChange={(e) => updateTrigger(t.id, { delay_seconds: Number(e.target.value) || 5 })}
                />
              </Field>

              <div className="sm:col-span-2">
                <Field
                  label="Message proactif envoyé par Lumi"
                  hint="Le visiteur recevra ce message dans le widget de façon engageante."
                >
                  <textarea
                    rows={2}
                    className={inputCls}
                    value={t.message}
                    onChange={(e) => updateTrigger(t.id, { message: e.target.value })}
                    placeholder="Bonjour ! Comment puis-je vous aider ?"
                  />
                </Field>
              </div>
            </div>
          </Card>
        ))}

        {triggers.length === 0 && (
          <Card className="text-center py-8">
            <p className="text-xs text-ink-400">Aucune campagne proactive configurée.</p>
            <button
              type="button"
              onClick={addTrigger}
              className="mt-3 inline-flex items-center rounded-xl bg-lagoon-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-lagoon-500 transition"
            >
              Créer votre premier message proactif
            </button>
          </Card>
        )}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <SaveButton busy={busy} />
        <FormNotice kind={notice?.kind ?? 'ok'} text={notice?.text ?? null} />
      </div>
    </form>
  );
}
