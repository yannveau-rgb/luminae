'use client';

/** Paramètres de sécurité, domaines autorisés, rétention et registre des demandes RGPD supervisées. */

import { useEffect, useState } from 'react';
import { Card, Field, FormNotice, SaveButton, SectionHeader, inputCls } from './parts';
import { type RgpdRequest } from '@/lib/rgpd-store';
import { cn, timeAgo } from '@/lib/utils';

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
  const [rgpdRequests, setRgpdRequests] = useState<RgpdRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [purgingId, setPurgingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/advanced-settings?section=security', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((j) => {
        if (j.security) setSettings(j.security);
      })
      .catch(() => {});

    fetch('/api/admin/rgpd', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((j) => {
        if (Array.isArray(j.requests)) setRgpdRequests(j.requests);
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

  async function executePurge(req: RgpdRequest) {
    if (!window.confirm(`Confirmer la purge manuelle des données personnelles du visiteur « ${req.visitor_name} » ?`)) {
      return;
    }
    setPurgingId(req.id);
    try {
      const res = await fetch('/api/admin/rgpd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: req.id,
          visitorId: req.visitor_id,
          conversationId: req.conversation_id,
          mode: 'anonymize'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setNotice({ kind: 'ok', text: data.message ?? 'Données purgées avec succès.' });
        // Rafraîchir la liste
        const ref = await fetch('/api/admin/rgpd');
        const j = await ref.json();
        if (Array.isArray(j.requests)) setRgpdRequests(j.requests);
      } else {
        setNotice({ kind: 'error', text: data.error ?? 'Erreur lors de la purge.' });
      }
    } catch {
      setNotice({ kind: 'error', text: 'Erreur réseau.' });
    }
    setPurgingId(null);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Sécurité, Domaines & Conformité RGPD"
        description="Garantissez la conformité RGPD (Droit à l'oubli supervisé), contrôlez les domaines autorisés et gérez le registre des demandes d'effacement."
      />

      <FormNotice kind={notice?.kind ?? 'ok'} text={notice?.text ?? null} />

      {/* ── Registre des demandes RGPD supervisées ─────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center justify-between border-b border-mist-200 pb-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-ink flex items-center gap-2">
              <span>🔒</span>
              <span>Registre des Demandes d&apos;Effacement RGPD (Droit à l&apos;Oubli)</span>
            </h2>
            <p className="text-[11px] text-ink-500 mt-0.5">
              Demandes soumises par les visiteurs ayant renseigné leurs coordonnées. Chaque suppression doit être validée manuellement par un conseiller.
            </p>
          </div>
          <span className="rounded-full bg-aurora-100 px-2.5 py-0.5 text-xs font-bold text-lagoon-700">
            {rgpdRequests.filter((r) => r.status === 'pending').length} en attente
          </span>
        </div>

        {rgpdRequests.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-400">
            <span className="text-xl block mb-1">🛡️</span>
            Aucune demande d&apos;effacement RGPD en attente dans le registre.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-mist-200 text-ink-400 font-semibold uppercase text-[10px]">
                  <th className="pb-2">Visiteur</th>
                  <th className="pb-2">Date demande</th>
                  <th className="pb-2">Statut</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist-200">
                {rgpdRequests.map((r) => (
                  <tr key={r.id} className="hover:bg-mist-50/50">
                    <td className="py-3 font-medium text-ink">
                      <p className="font-bold">{r.visitor_name || 'Visiteur'}</p>
                      <p className="font-mono text-[10.5px] text-ink-400">{r.visitor_id}</p>
                    </td>
                    <td className="py-3 text-ink-500">
                      {new Date(r.requested_at).toLocaleDateString('fr-FR')} ({timeAgo(r.requested_at)})
                    </td>
                    <td className="py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase',
                          r.status === 'pending'
                            ? 'bg-sun-100 text-sun-700'
                            : 'bg-lagoon-100 text-lagoon-700'
                        )}
                      >
                        {r.status === 'pending' ? '⏳ En attente de purge' : `✓ Purgé par ${r.processed_by ?? 'Agent'}`}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {r.status === 'pending' ? (
                        <button
                          onClick={() => executePurge(r)}
                          disabled={purgingId === r.id}
                          className="rounded-xl bg-coral-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-coral-500 disabled:opacity-50"
                        >
                          {purgingId === r.id ? 'Purge en cours…' : '🗑️ Exécuter la purge'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-ink-400 font-medium">Traité</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Paramètres de politique de rétention & domaines ──────────────────── */}
      <form onSubmit={submit} className="space-y-5">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Politique de Rétention Automatique</h2>
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

        <Card className="p-5">
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

        <div className="flex items-center gap-3">
          <SaveButton busy={busy} label="Enregistrer les paramètres de sécurité" />
        </div>
      </form>
    </div>
  );
}
