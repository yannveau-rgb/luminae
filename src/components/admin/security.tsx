'use client';

/** Paramètres de sécurité, domaines autorisés et rétention des données (RGPD / CNIL). */

import { useEffect, useState } from 'react';
import { Card, Field, FormNotice, SaveButton, SectionHeader, inputCls } from './parts';

export interface SecuritySettings {
  retention_days: number;
  allowed_domains: string;
  anonymize_ips: boolean;
  rate_limit_per_minute: number;
  block_disposable_emails: boolean;
}

const DEFAULT_SECURITY: SecuritySettings = {
  retention_days: 90,
  allowed_domains: '*',
  anonymize_ips: true,
  rate_limit_per_minute: 60,
  block_disposable_emails: true
};

export function SecurityPanel() {
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SECURITY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/advanced-settings?section=security', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((j) => {
        if (j.security) setSettings(j.security);
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
      body: JSON.stringify({ section: 'security', data: settings })
    });
    if (res.ok) {
      setNotice({ kind: 'ok', text: 'Paramètres de sécurité et RGPD enregistrés.' });
    } else {
      setNotice({ kind: 'error', text: 'Impossible d’enregistrer la sécurité.' });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <SectionHeader
        title="Sécurité, Domaines & Rétention RGPD"
        description="Garantissez la stricte conformité RGPD, contrôlez les domaines autorisés à intégrer votre widget et définissez les politiques de purge automatique."
      />

      <div className="space-y-5">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink">Politique de Rétention & Droit à l&apos;Oubli</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Purge automatique des conversations inactives"
              hint="Délai après lequel les messages et pièces jointes sont définitivement purgés."
            >
              <select
                className={inputCls}
                value={settings.retention_days}
                onChange={(e) => setSettings((s) => ({ ...s, retention_days: Number(e.target.value) }))}
              >
                <option value={30}>30 jours (Recommandé DPO strict)</option>
                <option value={90}>90 jours (Standard)</option>
                <option value={180}>180 jours (6 mois)</option>
                <option value={365}>365 jours (1 an)</option>
                <option value={0}>Aucune purge automatique (Infini)</option>
              </select>
            </Field>

            <div className="flex flex-col justify-center pt-2">
              <label className="flex items-center gap-2.5 text-xs font-medium text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.anonymize_ips}
                  onChange={(e) => setSettings((s) => ({ ...s, anonymize_ips: e.target.checked }))}
                  className="h-4 w-4 rounded border-mist-300 accent-lagoon-600"
                />
                <span>Anonymiser automatiquement les adresses IP (Masquage du dernier octet)</span>
              </label>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink">Contrôle d&apos;Origine & Domaines Autorisés</h2>
          <div className="space-y-4">
            <Field
              label="Liste des domaines autorisés (CORS / Embed Allowlist)"
              hint="Séparez les domaines par des virgules (ex: monsite.fr, app.monsite.fr). Utilisez * pour autoriser tous les domaines."
            >
              <input
                type="text"
                className={inputCls}
                value={settings.allowed_domains}
                onChange={(e) => setSettings((s) => ({ ...s, allowed_domains: e.target.value }))}
                placeholder="monsite.fr, app.monsite.fr"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Limite de requêtes par minute par IP (Anti-Spam)"
                hint="Bloque temporairement les visiteurs abusifs."
              >
                <input
                  type="number"
                  min={10}
                  max={300}
                  className={inputCls}
                  value={settings.rate_limit_per_minute}
                  onChange={(e) => setSettings((s) => ({ ...s, rate_limit_per_minute: Number(e.target.value) || 60 }))}
                />
              </Field>

              <div className="flex flex-col justify-center pt-2">
                <label className="flex items-center gap-2.5 text-xs font-medium text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.block_disposable_emails}
                    onChange={(e) => setSettings((s) => ({ ...s, block_disposable_emails: e.target.checked }))}
                    className="h-4 w-4 rounded border-mist-300 accent-lagoon-600"
                  />
                  <span>Refuser les e-mails jetables et temporaires sur le pré-chat</span>
                </label>
              </div>
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
