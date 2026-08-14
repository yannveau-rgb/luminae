'use client';

/** Configuration de la téléphonie et intégration Quicktalk (Ringover). */

import { useEffect, useState } from 'react';
import { Card, Field, FormNotice, SaveButton, SectionHeader, inputCls } from './parts';

export interface TelephonySettings {
  enabled: boolean;
  phone_number: string;
  quicktalk_url: string;
  button_label: string;
  widget_display: 'header' | 'action_card' | 'both';
  enable_agent_click_to_call: boolean;
}

const DEFAULT_TELEPHONY: TelephonySettings = {
  enabled: true,
  phone_number: '+33 1 89 00 00 00',
  quicktalk_url: '',
  button_label: 'Appeler un conseiller',
  widget_display: 'both',
  enable_agent_click_to_call: true
};

export function TelephonyPanel() {
  const [settings, setSettings] = useState<TelephonySettings>(DEFAULT_TELEPHONY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/advanced-settings?section=telephony', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((j) => {
        if (j.telephony) setSettings(j.telephony);
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
      body: JSON.stringify({ section: 'telephony', data: settings })
    });
    if (res.ok) {
      setNotice({ kind: 'ok', text: 'Paramètres de téléphonie et Quicktalk enregistrés avec succès.' });
    } else {
      setNotice({ kind: 'error', text: 'Impossible d’enregistrer la configuration.' });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <SectionHeader
        title="Téléphonie & Passerelle Quicktalk"
        description="Connectez votre numéro de téléphone d'entreprise ou votre standard Quicktalk (groupe Ringover) pour offrir un support omnicanal fluide (Chat IA + Téléphonie)."
      />

      <FormNotice kind={notice?.kind ?? 'ok'} text={notice?.text ?? null} />

      <div className="space-y-4">
        {/* Activation & Numéro */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-ink flex items-center gap-2">
                <span>📞</span>
                <span>Bouton d&apos;appel téléphonique direct dans le Widget</span>
              </p>
              <p className="text-[11px] text-ink-500">
                Permet aux visiteurs de joindre votre équipe par téléphone en 1 clic directement depuis le chat.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-mist-300 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-lagoon-600 peer-checked:after:translate-x-full" />
            </label>
          </div>

          {settings.enabled && (
            <div className="mt-5 space-y-4 border-t border-mist-200 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Numéro de téléphone d'accueil" hint="Format international recommandé (+33...)">
                  <input
                    className={inputCls}
                    value={settings.phone_number}
                    onChange={(e) => setSettings({ ...settings, phone_number: e.target.value })}
                    placeholder="+33 1 89 00 00 00"
                    required
                  />
                </Field>

                <Field label="Intitulé du bouton dans le widget">
                  <input
                    className={inputCls}
                    value={settings.button_label}
                    onChange={(e) => setSettings({ ...settings, button_label: e.target.value })}
                    placeholder="Appeler notre équipe"
                    required
                  />
                </Field>
              </div>

              <Field
                label="Lien ou URL Web Quicktalk (Optionnel)"
                hint="Si vous utilisez la Webapp / Dialer Quicktalk (ex: https://app.quicktalk.com/call/...)"
              >
                <input
                  className={inputCls}
                  value={settings.quicktalk_url}
                  onChange={(e) => setSettings({ ...settings, quicktalk_url: e.target.value })}
                  placeholder="https://app.quicktalk.com/..."
                />
              </Field>

              <Field label="Emplacement du bouton d'appel dans le widget">
                <select
                  className={inputCls}
                  value={settings.widget_display}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      widget_display: e.target.value as TelephonySettings['widget_display']
                    })
                  }
                >
                  <option value="both">Partout (En-tête du widget + Carte d&apos;action)</option>
                  <option value="header">Uniquement dans l&apos;en-tête (icône téléphone discrète)</option>
                  <option value="action_card">Uniquement sous le message d&apos;accueil (carte d&apos;action)</option>
                </select>
              </Field>
            </div>
          )}
        </Card>

        {/* Click-to-Dial pour les conseillers dans l'Inbox */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-ink flex items-center gap-2">
                <span>🎧</span>
                <span>Click-to-Dial Conseiller (Appel 1-Clic depuis l&apos;Inbox)</span>
              </p>
              <p className="text-[11px] text-ink-500">
                Affiche un bouton d&apos;appel instantané dans l&apos;inbox dès qu&apos;un numéro de téléphone est détecté chez un contact.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.enable_agent_click_to_call}
                onChange={(e) =>
                  setSettings({ ...settings, enable_agent_click_to_call: e.target.checked })
                }
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-mist-300 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-lagoon-600 peer-checked:after:translate-x-full" />
            </label>
          </div>
        </Card>

        {/* Encadré d'information Quicktalk */}
        <div className="rounded-2xl border border-lagoon-200 bg-lagoon-50/50 p-4 text-xs text-ink-600 flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div>
            <p className="font-semibold text-ink-900">À propos de Quicktalk (Groupe Ringover)</p>
            <p className="mt-0.5 text-lagoon-700 leading-relaxed">
              Quicktalk est la solution de téléphonie d&apos;entreprise française idéale pour centraliser vos appels entrants et sortants. En renseignant votre numéro ou lien Quicktalk, les appels de vos visiteurs sont directement dirigés vers vos conseillers connectés.
            </p>
          </div>
        </div>

        <SaveButton busy={busy} label="Enregistrer les paramètres de téléphonie" />
      </div>
    </form>
  );
}
