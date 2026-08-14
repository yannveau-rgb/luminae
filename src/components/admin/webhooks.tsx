'use client';

/** Gestionnaire des webhooks sortants et intégrations (Zapier, Slack, Make, HubSpot). */

import { useEffect, useState } from 'react';
import { Card, Field, FormNotice, SaveButton, SectionHeader, inputCls } from './parts';

export interface WebhookSettings {
  url: string;
  secret: string;
  enabled: boolean;
  events: string[];
}

const AVAILABLE_EVENTS = [
  { id: 'conversation.created', label: 'Nouvelle conversation initiée par un visiteur' },
  { id: 'conversation.escalated', label: 'Escalade vers un agent humain demandée' },
  { id: 'conversation.resolved', label: 'Conversation clôturée / résolue' },
  { id: 'message.visitor', label: 'Nouveau message envoyé par le visiteur' },
  { id: 'feedback.submitted', label: 'Évaluation satisfaction (Pouce haut / bas) reçue' }
];

const DEFAULT_WEBHOOK: WebhookSettings = {
  url: '',
  secret: 'whsec_' + Math.random().toString(36).substring(2, 15),
  enabled: false,
  events: ['conversation.escalated', 'conversation.resolved']
};

export function WebhooksPanel() {
  const [settings, setSettings] = useState<WebhookSettings>(DEFAULT_WEBHOOK);
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; status?: number; message: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/advanced-settings?section=webhooks', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((j) => {
        if (j.webhooks) setSettings(j.webhooks);
      })
      .catch(() => {});
  }, []);

  function toggleEvent(evtId: string) {
    setSettings((s) => {
      const exists = s.events.includes(evtId);
      return {
        ...s,
        events: exists ? s.events.filter((e) => e !== evtId) : [...s.events, evtId]
      };
    });
  }

  async function testWebhook() {
    if (!settings.url) {
      setTestResult({ success: false, message: 'Veuillez saisir une URL de webhook valide.' });
      return;
    }
    setTestBusy(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: settings.url, secret: settings.secret })
      });
      const j = await res.json();
      if (res.ok && j.success) {
        setTestResult({ success: true, status: j.status, message: `Ping réussi ! Code HTTP ${j.status}` });
      } else {
        setTestResult({ success: false, status: j.status, message: j.error || 'Échec de la transmission du ping.' });
      }
    } catch {
      setTestResult({ success: false, message: 'Erreur réseau lors de l’envoi du test.' });
    }
    setTestBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await fetch('/api/admin/advanced-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'webhooks', data: settings })
    });
    if (res.ok) {
      setNotice({ kind: 'ok', text: 'Paramètres du webhook enregistrés avec succès.' });
    } else {
      setNotice({ kind: 'error', text: 'Impossible d’enregistrer le webhook.' });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <SectionHeader
        title="Webhooks & Intégrations API"
        description="Connectez Luminae à vos outils métiers (Zapier, Make, Slack, CRM, bases de données) en recevant des événements HTTP POST en temps réel."
      />

      <div className="space-y-5">
        <Card>
          <div className="flex items-center justify-between pb-4 border-b border-mist-200">
            <div>
              <h2 className="text-sm font-semibold text-ink">Statut du Webhook Sortant</h2>
              <p className="text-xs text-ink-500">Transmettre les événements vers votre serveur ou plateforme d’automatisation.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
                className="h-4 w-4 rounded border-mist-300 accent-lagoon-600"
              />
              <span className="text-xs font-semibold text-ink">
                {settings.enabled ? 'Actif' : 'Inactif'}
              </span>
            </label>
          </div>

          <div className="mt-4 space-y-4">
            <Field
              label="URL Endpoint (HTTPS)"
              hint="L'adresse qui recevra les requêtes POST JSON signées."
            >
              <input
                type="url"
                className={inputCls}
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                value={settings.url}
                onChange={(e) => setSettings((s) => ({ ...s, url: e.target.value }))}
              />
            </Field>

            <Field
              label="Clé Secrète de Signature (HMAC SHA-256)"
              hint="Incluse dans l'en-tête X-Luminae-Signature pour authentifier l'expéditeur."
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  className={inputCls}
                  value={settings.secret}
                  onChange={(e) => setSettings((s) => ({ ...s, secret: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() =>
                    setSettings((s) => ({
                      ...s,
                      secret: 'whsec_' + Math.random().toString(36).substring(2, 15)
                    }))
                  }
                  className="rounded-xl border border-mist-300 px-3 text-xs font-medium text-ink-600 hover:bg-mist-100 transition whitespace-nowrap"
                >
                  Régénérer
                </button>
              </div>
            </Field>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={testWebhook}
              disabled={testBusy || !settings.url}
              className="rounded-xl border border-mist-300 bg-mist-50 px-4 py-2 text-xs font-semibold text-ink transition hover:bg-mist-100 disabled:opacity-50"
            >
              {testBusy ? 'Envoi du ping…' : '🚀 Envoyer un payload de test'}
            </button>
            {testResult && (
              <span
                className={`text-xs font-medium ${
                  testResult.success ? 'text-lagoon-600' : 'text-coral-600'
                }`}
              >
                {testResult.message}
              </span>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink">Événements Déclencheurs</h2>
          <div className="space-y-2.5">
            {AVAILABLE_EVENTS.map((evt) => {
              const active = settings.events.includes(evt.id);
              return (
                <label
                  key={evt.id}
                  className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition ${
                    active ? 'border-lagoon-300 bg-lagoon-50/50' : 'border-mist-200 bg-white hover:bg-mist-50/50'
                  }`}
                >
                  <div>
                    <p className="text-xs font-bold text-ink">{evt.id}</p>
                    <p className="text-[11px] text-ink-500">{evt.label}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleEvent(evt.id)}
                    className="h-4 w-4 rounded border-mist-300 accent-lagoon-600"
                  />
                </label>
              );
            })}
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
