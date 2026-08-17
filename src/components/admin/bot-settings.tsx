'use client';

/** Réglages du bot : identité, messages, comportement RAG. */

import { useEffect, useState } from 'react';
import type { BotSettings } from '@/lib/types';
import { Card, Field, FormNotice, SaveButton, SectionHeader, inputCls } from './parts';

export function BotSettingsForm() {
  const [s, setS] = useState<BotSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/bot-settings', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((j) => setS(j.settings))
      .catch(() => setNotice({ kind: 'error', text: 'Impossible de charger les réglages.' }));
  }, []);

  function set<K extends keyof BotSettings>(key: K, value: BotSettings[K]) {
    setS((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    setBusy(true);
    setNotice(null);
    const res = await fetch('/api/admin/bot-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s)
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setS(j.settings);
      setNotice({ kind: 'ok', text: 'Réglages enregistrés.' });
    } else {
      setNotice({ kind: 'error', text: j.error ?? 'La sauvegarde a échoué.' });
    }
    setBusy(false);
  }

  if (!s) {
    return <p className="text-sm text-ink-400">Chargement…</p>;
  }

  return (
    <form onSubmit={submit}>
      <SectionHeader
        title="Bot & widget"
        description="Identité, messages et comportement du bot. Les changements s’appliquent immédiatement au widget."
      />
      <div className="space-y-5">
        <Card>
          <h2 className="mb-4 text-sm font-semibold">Identité</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom du bot">
              <input className={inputCls} value={s.bot_name} onChange={(e) => set('bot_name', e.target.value)} />
            </Field>
            <Field label="Couleur d’accent" hint="Utilisée par le widget public.">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={s.accent_color}
                  onChange={(e) => set('accent_color', e.target.value)}
                  className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-mist-300 bg-white p-1"
                />
                <input className={inputCls} value={s.accent_color} onChange={(e) => set('accent_color', e.target.value)} />
              </div>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Suggestions de départ" hint="Une suggestion par ligne (6 maximum).">
                <textarea
                  className={inputCls}
                  rows={3}
                  value={s.suggestions.join('\n')}
                  onChange={(e) => set('suggestions', e.target.value.split('\n'))}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field
                label="Politique de confidentialité"
                hint="Adresse https. Affichée dans le pied du widget, à côté de « Supprimer mes données ». Laisser vide masque le lien."
              >
                <input
                  className={inputCls}
                  type="url"
                  placeholder="https://votre-site.fr/confidentialite"
                  value={s.privacy_url ?? ''}
                  onChange={(e) => set('privacy_url', e.target.value)}
                />
              </Field>
            </div>
          </div>
        </Card>

        {/* 🏢 Identité & Contexte de l'Entreprise */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🏢</span>
            <h2 className="text-sm font-bold text-ink">Identité de l&apos;Entreprise & Ambiance de Marque</h2>
          </div>
          <p className="text-xs text-ink-500 mb-4">
            Renseignez les détails de votre entreprise (nom, activité, style, consignes) pour que le bot s&apos;imprègne de votre identité et adopte naturellement le ton de votre marque.
          </p>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom de l'entreprise / Marque" hint="Ex: Maison Nova, Shop Élite, TechCare...">
                <input
                  className={inputCls}
                  value={s.company_name ?? ''}
                  onChange={(e) => set('company_name', e.target.value)}
                  placeholder="Maison Nova"
                />
              </Field>

              <Field label="Secteur & Activité principale" hint="Ex: Boutique de mode en ligne, SaaS B2B, Vente de matériel...">
                <input
                  className={inputCls}
                  value={s.company_activity ?? ''}
                  onChange={(e) => set('company_activity', e.target.value)}
                  placeholder="Boutique de prêt-à-porter et accessoires"
                />
              </Field>
            </div>

            <Field
              label="Présentation & Histoire de l'entreprise"
              hint="Ex: Marque française éco-responsable créée en 2022. Nous concevons nos produits à Paris et livrons sous 48h."
            >
              <textarea
                className={inputCls}
                rows={2}
                value={s.company_description ?? ''}
                onChange={(e) => set('company_description', e.target.value)}
                placeholder="Décrivez brièvement l'entreprise et ses points forts..."
              />
            </Field>

            <Field
              label="Ambiance & Style de communication souhaité"
              hint="Ex: Chaleureux, enthousiaste et dynamique / Expert, sobre et rassurant / Convivial et souriant..."
            >
              <input
                className={inputCls}
                value={s.brand_vibe ?? ''}
                onChange={(e) => set('brand_vibe', e.target.value)}
                placeholder="Chaleureux, bienveillant, dynamique et souriant"
              />
            </Field>

            <Field
              label="Consignes & Règles d'or spécifiques pour le Bot"
              hint="Ex: Rappeler la livraison gratuite dès 50€ d'achat. Ne jamais promettre de remboursement sans retour colis. Proposer un conseiller si le client hésite."
            >
              <textarea
                className={inputCls}
                rows={3}
                value={s.custom_instructions ?? ''}
                onChange={(e) => set('custom_instructions', e.target.value)}
                placeholder="Consignes particulières ou arguments clés à mettre en avant..."
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold">Messages</h2>
          <div className="space-y-4">
            <Field label="Message de bienvenue">
              <textarea className={inputCls} rows={2} value={s.welcome_message} onChange={(e) => set('welcome_message', e.target.value)} />
            </Field>
            <Field label="Message de repli" hint="Quand la base de connaissances ne permet pas de répondre.">
              <textarea className={inputCls} rows={2} value={s.fallback_message} onChange={(e) => set('fallback_message', e.target.value)} />
            </Field>
            <Field label="Message hors horaires" hint="Affiché quand l’équipe est fermée.">
              <textarea className={inputCls} rows={2} value={s.offline_message} onChange={(e) => set('offline_message', e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold">Comportement</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ton">
              <select className={inputCls} value={s.tone} onChange={(e) => set('tone', e.target.value as BotSettings['tone'])}>
                <option value="formal">Professionnel</option>
                <option value="casual">Décontracté</option>
              </select>
            </Field>
            <Field label="Longueur des réponses">
              <select
                className={inputCls}
                value={s.reply_length}
                onChange={(e) => set('reply_length', e.target.value as BotSettings['reply_length'])}
              >
                <option value="concise">Concise</option>
                <option value="normal">Normale</option>
                <option value="detailed">Détaillée</option>
              </select>
            </Field>
            <Field label="Seuil RAG" hint="Similarité minimale pour utiliser un article (0 à 1).">
              <input
                type="number"
                className={inputCls}
                min={0}
                max={1}
                step={0.05}
                value={s.rag_threshold}
                onChange={(e) => set('rag_threshold', Number(e.target.value))}
              />
            </Field>
            <Field label="Articles considérés (top K)" hint="Entre 1 et 10.">
              <input
                type="number"
                className={inputCls}
                min={1}
                max={10}
                value={s.rag_top_k}
                onChange={(e) => set('rag_top_k', Number(e.target.value))}
              />
            </Field>
            <label className="flex items-center gap-2.5 text-sm text-ink-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={s.small_talk_enabled}
                onChange={(e) => set('small_talk_enabled', e.target.checked)}
                className="h-4 w-4 accent-lagoon-600"
              />
              Autoriser la conversation légère (small talk)
            </label>
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