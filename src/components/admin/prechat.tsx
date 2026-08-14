'use client';

/** Configuration du formulaire pré-chat et qualification des visiteurs (Freshchat style). */

import { useEffect, useState } from 'react';
import { Card, Field, FormNotice, SaveButton, SectionHeader, inputCls } from './parts';

export interface PrechatSettings {
  enabled: boolean;
  mode: 'always' | 'offline_only';
  require_name: boolean;
  require_email: boolean;
  require_company: boolean;
  require_phone: boolean;
  require_subject: boolean;
  title: string;
  subtitle: string;
  consent_text: string;
}

const DEFAULT_PRECHAT: PrechatSettings = {
  enabled: true,
  mode: 'offline_only',
  require_name: true,
  require_email: true,
  require_company: false,
  require_phone: false,
  require_subject: true,
  title: 'Présentez-vous brièvement',
  subtitle: 'Pour que notre équipe ou Lumi puisse vous répondre avec précision.',
  consent_text: 'J’accepte que mes coordonnées soient traitées pour répondre à ma demande (RGPD).'
};

export function PrechatPanel() {
  const [settings, setSettings] = useState<PrechatSettings>(DEFAULT_PRECHAT);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/advanced-settings?section=prechat', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((j) => {
        if (j.prechat) setSettings(j.prechat);
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
      body: JSON.stringify({ section: 'prechat', data: settings })
    });
    if (res.ok) {
      setNotice({ kind: 'ok', text: 'Formulaire pré-chat enregistré avec succès.' });
    } else {
      setNotice({ kind: 'error', text: 'Impossible d’enregistrer les réglages.' });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <SectionHeader
        title="Formulaire Pré-Chat & Collecte de Leads"
        description="Qualifiez vos visiteurs avant qu'ils ne démarrent la conversation en recueillant leurs coordonnées professionnelles et le motif de leur demande."
      />

      <div className="space-y-5">
        <Card>
          <div className="flex items-center justify-between pb-4 border-b border-mist-200">
            <div>
              <h2 className="text-sm font-semibold text-ink">Activation du Formulaire</h2>
              <p className="text-xs text-ink-500">Demander les coordonnées avant l’ouverture du dialogue.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
                className="h-4 w-4 rounded border-mist-300 accent-lagoon-600"
              />
              <span className="text-xs font-semibold text-ink">
                {settings.enabled ? 'Activé' : 'Désactivé'}
              </span>
            </label>
          </div>

          {settings.enabled && (
            <div className="mt-4">
              <Field
                label="Quand afficher le formulaire ?"
                hint="Choisissez si le formulaire s'affiche en continu ou uniquement lorsque vos agents sont indisponibles."
              >
                <div className="grid gap-3 sm:grid-cols-2 mt-1">
                  {[
                    {
                      id: 'offline_only',
                      title: 'Uniquement Hors Horaires (Offline)',
                      desc: 'Permet de collecter un message et un e-mail quand l’équipe est fermée.'
                    },
                    {
                      id: 'always',
                      title: 'Toujours (Avant chaque chat)',
                      desc: 'Systématique pour identifier tout visiteur dès le premier échange.'
                    }
                  ].map((m) => {
                    const selected = settings.mode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setSettings((s) => ({ ...s, mode: m.id as PrechatSettings['mode'] }))
                        }
                        className={`rounded-xl border p-3.5 text-left transition ${
                          selected
                            ? 'border-lagoon-600 bg-lagoon-50 ring-2 ring-lagoon-500/20'
                            : 'border-mist-300 bg-white hover:border-mist-400'
                        }`}
                      >
                        <p className="text-xs font-bold text-ink">{m.title}</p>
                        <p className="mt-1 text-[11px] text-ink-500">{m.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          )}
        </Card>

        {settings.enabled && (
          <>
            <Card>
              <h2 className="mb-4 text-sm font-semibold text-ink">Champs à Collecter</h2>
              <div className="space-y-3">
                {[
                  { key: 'require_name', label: 'Nom et Prénom' },
                  { key: 'require_email', label: 'Adresse e-mail' },
                  { key: 'require_company', label: 'Nom de l’entreprise / Organisation' },
                  { key: 'require_phone', label: 'Numéro de téléphone' },
                  { key: 'require_subject', label: 'Objet / Sujet de la demande' }
                ].map((f) => (
                  <label key={f.key} className="flex items-center justify-between rounded-xl border border-mist-200 bg-mist-50/50 p-3 hover:bg-mist-100/50 transition cursor-pointer">
                    <span className="text-xs font-medium text-ink">{f.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(settings[f.key as keyof PrechatSettings])}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          [f.key]: e.target.checked
                        }))
                      }
                      className="h-4 w-4 rounded border-mist-300 accent-lagoon-600"
                    />
                  </label>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="mb-4 text-sm font-semibold text-ink">Textes & Consentement RGPD</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Titre d’en-tête du formulaire">
                  <input
                    type="text"
                    className={inputCls}
                    value={settings.title}
                    onChange={(e) => setSettings((s) => ({ ...s, title: e.target.value }))}
                  />
                </Field>

                <Field label="Sous-titre explicatif">
                  <input
                    type="text"
                    className={inputCls}
                    value={settings.subtitle}
                    onChange={(e) => setSettings((s) => ({ ...s, subtitle: e.target.value }))}
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field
                    label="Mention de consentement RGPD (Case à cocher)"
                    hint="Texte de la case obligatoire pour le respect de la vie privée."
                  >
                    <textarea
                      rows={2}
                      className={inputCls}
                      value={settings.consent_text}
                      onChange={(e) => setSettings((s) => ({ ...s, consent_text: e.target.value }))}
                    />
                  </Field>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <SaveButton busy={busy} />
        <FormNotice kind={notice?.kind ?? 'ok'} text={notice?.text ?? null} />
      </div>
    </form>
  );
}
