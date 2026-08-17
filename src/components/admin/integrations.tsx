'use client';

/**
 * Hub d'Intégrations & Connecteurs :
 * Quicktalk VoIP, E-commerce (Shopify / Stripe / WooCommerce), Alertes Slack / Discord,
 * Connecteurs CRM (HubSpot, Zapier, Make), Webhooks d'événements.
 */

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

export interface SlackIntegrationSettings {
  enabled: boolean;
  webhook_url: string;
  channel_name: string;
  notify_on_escalation: boolean;
  notify_on_new_conversation: boolean;
}

export interface ShopifyIntegrationSettings {
  enabled: boolean;
  shop_domain: string;
  admin_access_token: string;
  enable_ai_order_lookup: boolean;
  enable_agent_customer_card: boolean;
  enable_discount_generator: boolean;
}

export interface StripeIntegrationSettings {
  enabled: boolean;
  restricted_api_key: string;
  show_customer_subscriptions: boolean;
}

const DEFAULT_TELEPHONY: TelephonySettings = {
  enabled: true,
  phone_number: '+33 1 89 00 00 00',
  quicktalk_url: '',
  button_label: 'Appeler un conseiller',
  widget_display: 'both',
  enable_agent_click_to_call: true
};

const DEFAULT_SLACK: SlackIntegrationSettings = {
  enabled: false,
  webhook_url: '',
  channel_name: '#support-live',
  notify_on_escalation: true,
  notify_on_new_conversation: false
};

const DEFAULT_SHOPIFY: ShopifyIntegrationSettings = {
  enabled: false,
  shop_domain: '',
  admin_access_token: '',
  enable_ai_order_lookup: true,
  enable_agent_customer_card: true,
  enable_discount_generator: false
};

const DEFAULT_STRIPE: StripeIntegrationSettings = {
  enabled: false,
  restricted_api_key: '',
  show_customer_subscriptions: true
};

export function IntegrationsPanel() {
  const [activeSubTab, setActiveSubTab] = useState<'telephony' | 'ecommerce' | 'slack' | 'crm' | 'webhooks'>('telephony');
  const [telephony, setTelephony] = useState<TelephonySettings>(DEFAULT_TELEPHONY);
  const [slack, setSlack] = useState<SlackIntegrationSettings>(DEFAULT_SLACK);
  const [shopify, setShopify] = useState<ShopifyIntegrationSettings>(DEFAULT_SHOPIFY);
  const [stripe, setStripe] = useState<StripeIntegrationSettings>(DEFAULT_STRIPE);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/advanced-settings?section=integrations', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((j) => {
        if (j.telephony) setTelephony(j.telephony);
        if (j.slack) setSlack(j.slack);
        if (j.shopify) setShopify(j.shopify);
        if (j.stripe) setStripe(j.stripe);
      })
      .catch(() => {});
  }, []);

  async function submitTelephony(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await fetch('/api/admin/advanced-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'telephony', data: telephony })
    });
    if (res.ok) {
      setNotice({ kind: 'ok', text: 'Paramètres Quicktalk & Téléphonie enregistrés avec succès.' });
    } else {
      setNotice({ kind: 'error', text: 'Impossible d’enregistrer la configuration.' });
    }
    setBusy(false);
  }

  async function submitSlack(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await fetch('/api/admin/advanced-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'slack', data: slack })
    });
    if (res.ok) {
      setNotice({ kind: 'ok', text: 'Paramètres de notification Slack / Discord enregistrés.' });
    } else {
      setNotice({ kind: 'error', text: 'Impossible d’enregistrer la configuration Slack.' });
    }
    setBusy(false);
  }

  async function submitEcommerce(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res1 = await fetch('/api/admin/advanced-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'shopify', data: shopify })
    });
    const res2 = await fetch('/api/admin/advanced-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'stripe', data: stripe })
    });
    if (res1.ok && res2.ok) {
      setNotice({ kind: 'ok', text: 'Paramètres E-commerce (Shopify & Stripe) enregistrés avec succès.' });
    } else {
      setNotice({ kind: 'error', text: 'Impossible d’enregistrer la configuration e-commerce.' });
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Hub d'Intégrations & Connecteurs"
        description="Connectez Luminae à vos canaux de vente (Shopify, Stripe, WooCommerce), vos outils de communication (Quicktalk, Slack) et vos automatisations métier (Zapier, Make, Webhooks)."
      />

      <FormNotice kind={notice?.kind ?? 'ok'} text={notice?.text ?? null} />

      {/* Barre de navigation des connecteurs */}
      <div className="flex flex-wrap gap-2 border-b border-mist-300 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('telephony')}
          className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            activeSubTab === 'telephony'
              ? 'bg-lagoon-600 text-white shadow-glow-sm'
              : 'bg-white text-ink-600 border border-mist-300 hover:bg-mist'
          }`}
        >
          <span>📞</span>
          <span>Téléphonie (Quicktalk)</span>
          {telephony.enabled && (
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[9.5px]">Actif</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('ecommerce')}
          className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            activeSubTab === 'ecommerce'
              ? 'bg-lagoon-600 text-white shadow-glow-sm'
              : 'bg-white text-ink-600 border border-mist-300 hover:bg-mist'
          }`}
        >
          <span>🛍️</span>
          <span>E-commerce (Shopify / Stripe)</span>
          {(shopify.enabled || stripe.enabled) && (
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[9.5px]">Actif</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('slack')}
          className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            activeSubTab === 'slack'
              ? 'bg-lagoon-600 text-white shadow-glow-sm'
              : 'bg-white text-ink-600 border border-mist-300 hover:bg-mist'
          }`}
        >
          <span>💬</span>
          <span>Slack & Discord</span>
          {slack.enabled && (
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[9.5px]">Actif</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('crm')}
          className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            activeSubTab === 'crm'
              ? 'bg-lagoon-600 text-white shadow-glow-sm'
              : 'bg-white text-ink-600 border border-mist-300 hover:bg-mist'
          }`}
        >
          <span>💼</span>
          <span>CRM (HubSpot / Salesforce)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('webhooks')}
          className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            activeSubTab === 'webhooks'
              ? 'bg-lagoon-600 text-white shadow-glow-sm'
              : 'bg-white text-ink-600 border border-mist-300 hover:bg-mist'
          }`}
        >
          <span>⚡</span>
          <span>Zapier, Make & API</span>
        </button>
      </div>

      {/* ── 1. Onglet Téléphonie & Quicktalk ───────────────────────────────── */}
      {activeSubTab === 'telephony' && (
        <form onSubmit={submitTelephony} className="space-y-4">
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
                  checked={telephony.enabled}
                  onChange={(e) => setTelephony({ ...telephony, enabled: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-5 w-9 rounded-full bg-mist-300 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-lagoon-600 peer-checked:after:translate-x-full" />
              </label>
            </div>

            {telephony.enabled && (
              <div className="mt-5 space-y-4 border-t border-mist-200 pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Numéro de téléphone d'accueil" hint="Format international recommandé (+33...)">
                    <input
                      className={inputCls}
                      value={telephony.phone_number}
                      onChange={(e) => setTelephony({ ...telephony, phone_number: e.target.value })}
                      placeholder="+33 1 89 00 00 00"
                      required
                    />
                  </Field>

                  <Field label="Intitulé du bouton dans le widget">
                    <input
                      className={inputCls}
                      value={telephony.button_label}
                      onChange={(e) => setTelephony({ ...telephony, button_label: e.target.value })}
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
                    value={telephony.quicktalk_url}
                    onChange={(e) => setTelephony({ ...telephony, quicktalk_url: e.target.value })}
                    placeholder="https://app.quicktalk.com/..."
                  />
                </Field>

                <Field label="Emplacement du bouton d'appel dans le widget">
                  <select
                    className={inputCls}
                    value={telephony.widget_display}
                    onChange={(e) =>
                      setTelephony({
                        ...telephony,
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
                  checked={telephony.enable_agent_click_to_call}
                  onChange={(e) =>
                    setTelephony({ ...telephony, enable_agent_click_to_call: e.target.checked })
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
                Quicktalk est la solution de téléphonie d&apos;entreprise française souveraine pour centraliser vos appels. En renseignant votre numéro ou lien Quicktalk, les appels de vos visiteurs sont directement dirigés vers vos conseillers connectés.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <SaveButton busy={busy} />
          </div>
        </form>
      )}

      {/* ── 2. Onglet E-commerce (Shopify & Stripe) ─────────────────────────── */}
      {activeSubTab === 'ecommerce' && (
        <form onSubmit={submitEcommerce} className="space-y-4">
          {/* Connecteur Shopify */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aurora-500/10 border border-aurora-500/20 text-lg">
                  🛍️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-display text-sm font-bold text-ink">Boutique Shopify</h4>
                    <span className="rounded bg-lagoon-100 px-1.5 py-0.2 text-[9.5px] font-bold text-lagoon-700">Recommandé</span>
                  </div>
                  <p className="text-xs text-ink-500 mt-0.5">
                    Permet au Bot Lumi de répondre au statut des commandes (« Où est ma commande #1234 ? ») et affiche les achats du client aux conseillers.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center shrink-0">
                <input
                  type="checkbox"
                  checked={shopify.enabled}
                  onChange={(e) => setShopify({ ...shopify, enabled: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-5 w-9 rounded-full bg-mist-300 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-lagoon-600 peer-checked:after:translate-x-full" />
              </label>
            </div>

            {shopify.enabled && (
              <div className="mt-5 space-y-4 border-t border-mist-200 pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nom de domaine de la boutique" hint="Ex: ma-boutique.myshopify.com">
                    <input
                      className={inputCls}
                      value={shopify.shop_domain}
                      onChange={(e) => setShopify({ ...shopify, shop_domain: e.target.value })}
                      placeholder="ma-marque.myshopify.com"
                      required
                    />
                  </Field>

                  <Field label="Token d'accès API Admin Shopify" hint="Généré dans Paramètres > Applications > Développer des applis">
                    <input
                      type="password"
                      className={inputCls}
                      value={shopify.admin_access_token}
                      onChange={(e) => setShopify({ ...shopify, admin_access_token: e.target.value })}
                      placeholder="shpat_xxxxxxxxxxxxxxxxxxxx"
                      required
                    />
                  </Field>
                </div>

                <div className="space-y-2 rounded-xl bg-mist-50 p-3.5 border border-mist-200 text-xs">
                  <p className="font-bold text-ink-800 mb-1.5">Fonctionnalités E-commerce activées :</p>
                  <label className="flex items-center gap-2 text-ink-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shopify.enable_ai_order_lookup}
                      onChange={(e) => setShopify({ ...shopify, enable_ai_order_lookup: e.target.checked })}
                      className="rounded border-mist-300 text-lagoon-600"
                    />
                    <span>📦 <strong>Suivi de commande automatique par l&apos;IA</strong> (Recherche statut Colissimo / Chronopost sans intervention humaine)</span>
                  </label>
                  <label className="flex items-center gap-2 text-ink-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shopify.enable_agent_customer_card}
                      onChange={(e) => setShopify({ ...shopify, enable_agent_customer_card: e.target.checked })}
                      className="rounded border-mist-300 text-lagoon-600"
                    />
                    <span>👤 <strong>Historique & Panier dans l&apos;Inbox Agent</strong> (Total dépensé, statut de la dernière commande, lien Shopify direct)</span>
                  </label>
                  <label className="flex items-center gap-2 text-ink-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shopify.enable_discount_generator}
                      onChange={(e) => setShopify({ ...shopify, enable_discount_generator: e.target.checked })}
                      className="rounded border-mist-300 text-lagoon-600"
                    />
                    <span>🎟️ <strong>Bouton Code Promo 1-Clic</strong> pour dédommagement client direct dans le chat</span>
                  </label>
                </div>
              </div>
            )}
          </Card>

          {/* Connecteur Stripe & Abonnements */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lagoon-500/10 border border-lagoon-500/20 text-lg">
                  💳
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold text-ink">Stripe (Paiements & Abonnements)</h4>
                  <p className="text-xs text-ink-500 mt-0.5">
                    Affiche le statut de l&apos;abonnement, les dernières factures et le plan souscrit par le client dans l&apos;inbox agent.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center shrink-0">
                <input
                  type="checkbox"
                  checked={stripe.enabled}
                  onChange={(e) => setStripe({ ...stripe, enabled: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-5 w-9 rounded-full bg-mist-300 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-lagoon-600 peer-checked:after:translate-x-full" />
              </label>
            </div>

            {stripe.enabled && (
              <div className="mt-5 space-y-4 border-t border-mist-200 pt-4">
                <Field label="Clé API Restreinte Stripe (Lecture seule sur Customers & Subscriptions)" hint="Ex: rk_live_... ou rk_test_...">
                  <input
                    type="password"
                    className={inputCls}
                    value={stripe.restricted_api_key}
                    onChange={(e) => setStripe({ ...stripe, restricted_api_key: e.target.value })}
                    placeholder="rk_live_xxxxxxxxxxxxxxxxxxxx"
                    required
                  />
                </Field>
              </div>
            )}
          </Card>

          {/* WooCommerce & PrestaShop info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-4 bg-mist-50 border border-mist-200">
              <div className="flex items-center gap-2">
                <span>🟣</span>
                <h5 className="text-xs font-bold text-ink">WooCommerce (WordPress)</h5>
              </div>
              <p className="mt-1 text-[11px] text-ink-500 leading-relaxed">
                Connectable immédiatement via le script d&apos;intégration dans le header/footer de votre thème WordPress ou via Webhook WooCommerce.
              </p>
            </Card>

            <Card className="p-4 bg-mist-50 border border-mist-200">
              <div className="flex items-center gap-2">
                <span>🐧</span>
                <h5 className="text-xs font-bold text-ink">PrestaShop & Magento</h5>
              </div>
              <p className="mt-1 text-[11px] text-ink-500 leading-relaxed">
                Compatible nativement avec toutes les boutiques e-commerce par insertion du script de chat ou par passerelle Webhook API.
              </p>
            </Card>
          </div>

          <div className="flex justify-end pt-2">
            <SaveButton busy={busy} />
          </div>
        </form>
      )}

      {/* ── 3. Onglet Slack & Discord ───────────────────────────────────────── */}
      {activeSubTab === 'slack' && (
        <form onSubmit={submitSlack} className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-ink flex items-center gap-2">
                  <span>💬</span>
                  <span>Alertes instantanées sur canal Slack ou Discord</span>
                </p>
                <p className="text-[11px] text-ink-500">
                  Envoyez une notification avec lien direct vers la conversation dès qu&apos;une escalade est déclenchée.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={slack.enabled}
                  onChange={(e) => setSlack({ ...slack, enabled: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-5 w-9 rounded-full bg-mist-300 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-lagoon-600 peer-checked:after:translate-x-full" />
              </label>
            </div>

            {slack.enabled && (
              <div className="mt-5 space-y-4 border-t border-mist-200 pt-4">
                <Field label="URL du Webhook Entrant (Incoming Webhook)" hint="Ex: https://hooks.slack.com/services/... ou https://discord.com/api/webhooks/...">
                  <input
                    className={inputCls}
                    value={slack.webhook_url}
                    onChange={(e) => setSlack({ ...slack, webhook_url: e.target.value })}
                    placeholder="https://hooks.slack.com/services/..."
                    required
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nom du canal d'affichage (Optionnel)">
                    <input
                      className={inputCls}
                      value={slack.channel_name}
                      onChange={(e) => setSlack({ ...slack, channel_name: e.target.value })}
                      placeholder="#support-live"
                    />
                  </Field>

                  <div className="flex flex-col justify-center space-y-2 pt-2">
                    <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={slack.notify_on_escalation}
                        onChange={(e) => setSlack({ ...slack, notify_on_escalation: e.target.checked })}
                        className="rounded border-mist-300 text-lagoon-600"
                      />
                      <span>Alerter lors d&apos;une escalade vers un humain</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={slack.notify_on_new_conversation}
                        onChange={(e) => setSlack({ ...slack, notify_on_new_conversation: e.target.checked })}
                        className="rounded border-mist-300 text-lagoon-600"
                      />
                      <span>Alerter à chaque nouvelle conversation</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <div className="flex justify-end pt-2">
            <SaveButton busy={busy} />
          </div>
        </form>
      )}

      {/* ── 4. Onglet CRM & Outils Métier ───────────────────────────────────── */}
      {activeSubTab === 'crm' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xl">🟠</span>
                  <span className="rounded bg-lagoon-100 px-2 py-0.5 text-[10px] font-bold text-lagoon-700">
                    Connecteur Natif
                  </span>
                </div>
                <h4 className="font-display text-sm font-bold text-ink mt-3">HubSpot CRM</h4>
                <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                  Synchronisation automatique des coordonnées collectées (nom, email, téléphone) et rattachement des résumés d&apos;échanges aux fiches contacts HubSpot.
                </p>
              </div>
              <button
                type="button"
                onClick={() => alert('Pour activer la synchronisation HubSpot, renseignez votre clé API dans les Webhooks ou contactez le support.')}
                className="mt-4 w-full rounded-xl border border-mist-300 bg-mist-50 px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-mist transition"
              >
                Configurer le flux HubSpot
              </button>
            </Card>

            <Card className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xl">☁️</span>
                  <span className="rounded bg-mist-200 px-2 py-0.5 text-[10px] font-bold text-ink-600">
                    Bientôt disponible
                  </span>
                </div>
                <h4 className="font-display text-sm font-bold text-ink mt-3">Salesforce Service Cloud</h4>
                <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                  Création automatique de requêtes (Cases) ou de Leads Salesforce lors des escalades hors horaires d&apos;ouverture.
                </p>
              </div>
              <button
                type="button"
                disabled
                className="mt-4 w-full rounded-xl border border-mist-200 bg-mist-100 px-3 py-2 text-xs font-medium text-ink-400 opacity-60 cursor-not-allowed"
              >
                Bientôt disponible
              </button>
            </Card>
          </div>
        </div>
      )}

      {/* ── 5. Onglet Zapier, Make & Webhooks ────────────────────────────────── */}
      {activeSubTab === 'webhooks' && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <div>
                <h4 className="font-display text-sm font-bold text-ink">Automatisation Zapier, Make & Webhooks Sortants</h4>
                <p className="text-xs text-ink-500">
                  Déclenchez des scénarios automatisés à chaque événement de conversation (Nouveau contact, Escalade, Clôture).
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-ink-600 bg-mist-50 p-3 rounded-xl border border-mist-200 leading-relaxed">
            Vous pouvez configurer jusqu&apos;à 10 webhooks HTTPS personnalisés avec signature cryptographique HMAC dans l&apos;onglet dédié <strong>« Webhooks & Développeurs »</strong> du menu de gauche.
          </p>
        </Card>
      )}
    </div>
  );
}

// Export de rétrocompatibilité
export const TelephonyPanel = IntegrationsPanel;
