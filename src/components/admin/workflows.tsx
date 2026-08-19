'use client';

/**
 * Gestionnaire des workflows intelligents et automatisations (Freshchat / Intercom style).
 * Moteur visuel No-Code (Flow Canvas par nœuds et branches + mode tableau de bord)
 * avec bibliothèque de modèles prêts à l'emploi et simulateur interactif.
 */

import { useEffect, useState } from 'react';
import { Card, EmptyState, Field, FormNotice, SaveButton, SectionHeader, SkeletonCard, inputCls } from './parts';
import { type WorkflowActionType, type WorkflowRule, type WorkflowTriggerType, WORKFLOW_TEMPLATES } from '@/lib/workflow-types';
import { type VisualWorkflow, VISUAL_WORKFLOW_TEMPLATES } from '@/lib/visual-workflow';
import { FlowCanvas } from './flow-canvas';
import { cn, timeAgo } from '@/lib/utils';

export function WorkflowsPanel() {
  const [workflows, setWorkflows] = useState<WorkflowRule[]>(WORKFLOW_TEMPLATES);
  const [visualWorkflows, setVisualWorkflows] = useState<VisualWorkflow[]>(VISUAL_WORKFLOW_TEMPLATES);
  const [activeVisualWf, setActiveVisualWf] = useState<VisualWorkflow | null>(null);
  const [editingWf, setEditingWf] = useState<WorkflowRule | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/advanced-settings?section=workflows', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((j) => {
        if (Array.isArray(j.workflows) && j.workflows.length > 0) {
          setWorkflows(j.workflows);
        }
        if (Array.isArray(j.visualWorkflows) && j.visualWorkflows.length > 0) {
          setVisualWorkflows(j.visualWorkflows);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveWorkflowsList(list: WorkflowRule[], vList?: VisualWorkflow[]) {
    setBusy(true);
    setNotice(null);
    const res = await fetch('/api/admin/advanced-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'workflows',
        data: list,
        visualWorkflows: vList || visualWorkflows
      })
    });
    if (res.ok) {
      setWorkflows(list);
      if (vList) setVisualWorkflows(vList);
      setNotice({ kind: 'ok', text: 'Workflows et scénarios visuels enregistrés avec succès.' });
    } else {
      setNotice({ kind: 'error', text: 'Impossible d’enregistrer les workflows.' });
    }
    setBusy(false);
  }

  function handleSaveVisualWf(savedWf: VisualWorkflow) {
    const exists = visualWorkflows.some((w) => w.id === savedWf.id);
    const updated = exists
      ? visualWorkflows.map((w) => (w.id === savedWf.id ? savedWf : w))
      : [savedWf, ...visualWorkflows];
    setVisualWorkflows(updated);
    saveWorkflowsList(workflows, updated);
    setActiveVisualWf(null);
  }

  function toggleWorkflow(id: string) {
    const updated = workflows.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w));
    saveWorkflowsList(updated);
  }

  function removeWorkflow(id: string) {
    const updated = workflows.filter((w) => w.id !== id);
    saveWorkflowsList(updated);
  }

  function saveEdited(e: React.FormEvent) {
    e.preventDefault();
    if (!editingWf) return;
    const exists = workflows.some((w) => w.id === editingWf.id);
    const updated = exists
      ? workflows.map((w) => (w.id === editingWf.id ? editingWf : w))
      : [...workflows, editingWf];
    saveWorkflowsList(updated);
    setEditingWf(null);
  }

  function createNew() {
    setEditingWf({
      id: `wf_${Date.now()}`,
      name: 'Nouveau Scénario d’Automatisation',
      description: 'Déclenche une action personnalisée selon les intentions et le parcours du visiteur.',
      enabled: true,
      trigger: 'message_received',
      conditions: {
        keywords: ['aide', 'question']
      },
      actions: [
        {
          type: 'send_message',
          payload: 'Bonjour ! Comment pouvons-nous vous assister ?'
        }
      ],
      execution_count: 0
    });
  }

  function addAction(type: WorkflowActionType) {
    if (!editingWf) return;
    const defaultPayload =
      type === 'send_message'
        ? 'Bonjour ! Que pouvons-nous faire pour vous ?'
        : type === 'add_tag'
          ? 'Nouveau Tag'
          : type === 'add_internal_note'
            ? '🔒 Note interne déclenchée automatiquement par le workflow.'
            : type === 'suggest_call'
              ? 'Demander un rappel'
              : 'https://webhook.site/...';
    setEditingWf({
      ...editingWf,
      actions: [...editingWf.actions, { type, payload: defaultPayload }]
    });
  }

  function updateAction(index: number, payload: string) {
    if (!editingWf) return;
    const nextActions = [...editingWf.actions];
    nextActions[index] = { ...nextActions[index], payload };
    setEditingWf({ ...editingWf, actions: nextActions });
  }

  function removeAction(index: number) {
    if (!editingWf) return;
    const nextActions = editingWf.actions.filter((_, i) => i !== index);
    setEditingWf({ ...editingWf, actions: nextActions });
  }

  function addTemplate(template: WorkflowRule) {
    const newWf: WorkflowRule = {
      ...template,
      id: `wf_${Date.now()}`,
      execution_count: 0,
      last_executed_at: null
    };
    const updated = [newWf, ...workflows];
    saveWorkflowsList(updated);
    setTemplatePickerOpen(false);
    setEditingWf(newWf);
  }

  function openVisualTemplate(vTmpl: VisualWorkflow) {
    const newWf: VisualWorkflow = {
      ...vTmpl,
      id: `vwf_${Date.now()}`,
      execution_count: 0,
      last_executed_at: null
    };
    setTemplatePickerOpen(false);
    setActiveVisualWf(newWf);
  }

  // ── VUE DU STUDIO VISUEL PLEIN ÉCRAN (FLOW CANVAS) ────────────────────────
  if (activeVisualWf) {
    return (
      <FlowCanvas
        workflow={activeVisualWf}
        onSave={handleSaveVisualWf}
        onClose={() => setActiveVisualWf(null)}
      />
    );
  }

  // ── VUE ÉDITEUR CLASSIQUE ──────────────────────────────────────────────────
  if (editingWf) {
    return (
      <form onSubmit={saveEdited} className="space-y-4 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader
            title={editingWf.name || 'Éditer le workflow'}
            description="Définissez les conditions de déclenchement et la chaîne d'actions exécutée automatiquement."
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingWf(null)}
              className="rounded-xl border border-mist-300 bg-white px-3.5 py-2 text-xs font-semibold text-ink-600 transition hover:bg-mist"
            >
              Annuler
            </button>
            <SaveButton busy={busy} label="Enregistrer le workflow" />
          </div>
        </div>

        <FormNotice kind={notice?.kind ?? 'ok'} text={notice?.text ?? null} />

        <Card className="p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom du workflow" required>
              <input
                className={inputCls}
                value={editingWf.name}
                onChange={(e) => setEditingWf({ ...editingWf, name: e.target.value })}
                required
              />
            </Field>

            <Field label="Objectif / Description rapide">
              <input
                className={inputCls}
                value={editingWf.description}
                onChange={(e) => setEditingWf({ ...editingWf, description: e.target.value })}
                placeholder="Ex: Qualification lead commercial, Relance panier..."
              />
            </Field>
          </div>

          {/* ⚡ 1. DÉCLENCHEUR (TRIGGER) */}
          <div className="rounded-2xl border border-mist-300/80 bg-mist-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-ink flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sun-100 text-sun-700 text-xs font-bold">
                  1
                </span>
                <span>⚡ Déclencheur (Quand exécuter ce scénario ?)</span>
              </p>
              <span className="text-[10.5px] font-mono font-medium text-ink-400">Événement Source</span>
            </div>

            <select
              className={inputCls}
              value={editingWf.trigger}
              onChange={(e) =>
                setEditingWf({
                  ...editingWf,
                  trigger: e.target.value as WorkflowTriggerType
                })
              }
            >
              <option value="message_received">💬 À chaque message visiteur reçu</option>
              <option value="intent_detected">🎯 Lorsqu’une intention spécifique est détectée par l’IA</option>
              <option value="page_visited">🌐 Dès que le visiteur visite une page (ex: /panier, /tarifs)</option>
              <option value="after_hours">🌙 En dehors des horaires d’ouverture (Équipe hors ligne)</option>
              <option value="conversation_escalated">⚡ Lors d’une demande d’escalade vers un conseiller</option>
            </select>

            {editingWf.trigger === 'intent_detected' && (
              <Field label="Intention IA ciblée">
                <select
                  className={inputCls}
                  value={editingWf.trigger_value ?? 'pricing_subscription'}
                  onChange={(e) => setEditingWf({ ...editingWf, trigger_value: e.target.value })}
                >
                  <option value="pricing_subscription">🎯 Tarifs, Forfaits & Devis</option>
                  <option value="orders_shipping">📦 Suivi de Commande & Livraison</option>
                  <option value="refunds_returns">↩️ Retours, Échanges & Remboursements</option>
                  <option value="tech_support_access">🔧 Support Technique & Connexion</option>
                  <option value="security_gdpr">🔒 Sécurité, Données & RGPD</option>
                </select>
              </Field>
            )}

            {editingWf.trigger === 'page_visited' && (
              <Field label="URL ou chemin de page" hint="Ex: /panier, /checkout, /tarifs, /contact">
                <input
                  className={inputCls}
                  value={editingWf.trigger_value ?? 'panier'}
                  onChange={(e) => setEditingWf({ ...editingWf, trigger_value: e.target.value })}
                  placeholder="/panier"
                />
              </Field>
            )}
          </div>

          {/* 🔍 2. CONDITIONS DE FILTRAGE */}
          <div className="rounded-2xl border border-mist-300/80 bg-mist-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-ink flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-aurora-100 text-lagoon-700 text-xs font-bold">
                  2
                </span>
                <span>🔍 Conditions de Filtrage (SI...)</span>
              </p>
              <span className="text-[10.5px] font-mono font-medium text-ink-400">Règles Métier</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mots-clés déclencheurs" hint="Séparés par des virgules (insensible à la casse).">
                <input
                  className={inputCls}
                  value={(editingWf.conditions.keywords ?? []).join(', ')}
                  onChange={(e) =>
                    setEditingWf({
                      ...editingWf,
                      conditions: {
                        ...editingWf.conditions,
                        keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean)
                      }
                    })
                  }
                  placeholder="urgent, tarif, prix, devis, problème, panne"
                />
              </Field>

              <Field label="Filtrer par URL de page (Optionnel)" hint="Ex: /boutique, /pricing, /aide">
                <input
                  className={inputCls}
                  value={editingWf.conditions.url_contains ?? ''}
                  onChange={(e) =>
                    setEditingWf({
                      ...editingWf,
                      conditions: { ...editingWf.conditions, url_contains: e.target.value }
                    })
                  }
                  placeholder="/tarifs"
                />
              </Field>
            </div>
          </div>

          {/* 🚀 3. CHAÎNE D'ACTIONS AUTOMATISÉES */}
          <div className="rounded-2xl border border-lagoon-200 bg-lagoon-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-ink flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-lagoon-600 text-white text-xs font-bold">
                  3
                </span>
                <span>🚀 Actions Automatisées Chaînées (ALORS...)</span>
              </p>
              <span className="text-[10.5px] font-mono font-medium text-lagoon-700">
                {editingWf.actions.length} action{editingWf.actions.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-3">
              {editingWf.actions.map((act, idx) => (
                <div key={idx} className="rounded-xl border border-lagoon-200/80 bg-white p-3.5 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-lagoon-700 flex items-center gap-1.5">
                      {act.type === 'send_message' && '💬 Envoyer un message automatique'}
                      {act.type === 'add_tag' && '🏷️ Appliquer un tag à la conversation'}
                      {act.type === 'add_internal_note' && '🔒 Ajouter une note interne d’équipe'}
                      {act.type === 'suggest_call' && '📞 Proposer le bouton d’appel Quicktalk'}
                      {act.type === 'send_webhook' && '🌐 Déclencher un Webhook externe'}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeAction(idx)}
                      className="text-ink-400 hover:text-coral-600 text-xs px-1.5 py-0.5 rounded hover:bg-mist"
                      title="Supprimer cette action"
                    >
                      ✕
                    </button>
                  </div>

                  {act.type === 'send_message' && (
                    <textarea
                      className={inputCls}
                      rows={2}
                      value={act.payload ?? ''}
                      onChange={(e) => updateAction(idx, e.target.value)}
                      placeholder="Texte du message envoyé automatiquement par le bot..."
                      required
                    />
                  )}

                  {act.type === 'add_tag' && (
                    <input
                      className={inputCls}
                      value={act.payload ?? ''}
                      onChange={(e) => updateAction(idx, e.target.value)}
                      placeholder="Nom du tag (ex: Lead Chaud, Urgence, Panier)"
                      required
                    />
                  )}

                  {act.type === 'add_internal_note' && (
                    <textarea
                      className={inputCls}
                      rows={2}
                      value={act.payload ?? ''}
                      onChange={(e) => updateAction(idx, e.target.value)}
                      placeholder="Note confidentielle enregistrée dans l'Inbox pour les conseillers..."
                      required
                    />
                  )}

                  {act.type === 'suggest_call' && (
                    <input
                      className={inputCls}
                      value={act.payload ?? ''}
                      onChange={(e) => updateAction(idx, e.target.value)}
                      placeholder="Libellé du bouton (ex: Demander un rappel téléphonique)"
                    />
                  )}

                  {act.type === 'send_webhook' && (
                    <input
                      className={inputCls}
                      type="url"
                      value={act.payload ?? ''}
                      onChange={(e) => updateAction(idx, e.target.value)}
                      placeholder="https://hooks.slack.com/services/... ou Zapier Webhook URL"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Boutons d'ajout d'action */}
            <div className="pt-2 border-t border-lagoon-200/60">
              <span className="block text-[11px] font-semibold text-ink-600 mb-1.5">+ Ajouter une action chaînée :</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => addAction('send_message')}
                  className="rounded-xl border border-mist-300 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist transition active:scale-95"
                >
                  + 💬 Message Auto
                </button>
                <button
                  type="button"
                  onClick={() => addAction('add_tag')}
                  className="rounded-xl border border-mist-300 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist transition active:scale-95"
                >
                  + 🏷️ Taguer
                </button>
                <button
                  type="button"
                  onClick={() => addAction('add_internal_note')}
                  className="rounded-xl border border-mist-300 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist transition active:scale-95"
                >
                  + 🔒 Note Interne
                </button>
                <button
                  type="button"
                  onClick={() => addAction('suggest_call')}
                  className="rounded-xl border border-mist-300 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist transition active:scale-95"
                >
                  + 📞 Appel Quicktalk
                </button>
                <button
                  type="button"
                  onClick={() => addAction('send_webhook')}
                  className="rounded-xl border border-mist-300 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist transition active:scale-95"
                >
                  + 🌐 Webhook
                </button>
              </div>
            </div>
          </div>
        </Card>
      </form>
    );
  }

  // ── VUE LISTE DES WORKFLOWS ────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          title="Workflows & Studio Visuel No-Code"
          description="Pilotez vos scénarios No-Code par nœuds et branches pour aiguiller les visiteurs, automatiser le support et router les opportunités."
        />

        <div className="flex flex-wrap items-center gap-2">
          {/* Bouton pour ouvrir le Studio Visuel */}
          <button
            type="button"
            onClick={() => setActiveVisualWf(visualWorkflows[0] || VISUAL_WORKFLOW_TEMPLATES[0])}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-lagoon-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:from-blue-500 hover:to-lagoon-500 transition active:scale-95"
          >
            <span>🎨</span>
            <span>Ouvrir le Studio Visuel (Flow Canvas)</span>
          </button>

          <button
            type="button"
            onClick={() => setTemplatePickerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-mist-300 bg-white px-3.5 py-2 text-xs font-semibold text-ink shadow-sm transition hover:bg-mist hover:border-mist-400 active:scale-95"
          >
            <span>✨</span>
            <span>Modèles Prêts à l&apos;Emploi</span>
          </button>

          <button
            type="button"
            onClick={createNew}
            className="inline-flex items-center gap-1.5 rounded-xl bg-lagoon-600 px-4 py-2 text-xs font-semibold text-white shadow-glow-sm transition hover:bg-lagoon-500 active:scale-95"
          >
            + Nouveau Scénario
          </button>
        </div>
      </div>

      <FormNotice kind={notice?.kind ?? 'ok'} text={notice?.text ?? null} />

      {/* ── BANNIÈRE PROMOTIONNELLE STUDIO VISUEL FLOW CANVAS ─────────────── */}
      <div className="rounded-3xl border border-blue-500/30 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(#38bdf820_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none opacity-50" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-0.5 text-[11px] font-bold text-sky-300 border border-sky-500/30">
              <span>✨ Flow Builder Visuel par Nœuds & Branches</span>
            </div>
            <h3 className="font-display text-lg font-bold text-white tracking-tight">
              Créez des arbres décisionnels complets avec boutons interactifs
            </h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Modélisez vos scénarios complexes sur une grille infinie avec zoom, mini-map, questions à choix multiples (Oui/Non, bifurcations Chrome/Edge/Safari) et testez-les en direct avec le simulateur.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveVisualWf(visualWorkflows[0] || VISUAL_WORKFLOW_TEMPLATES[0])}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-400 to-lagoon-400 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-glow hover:opacity-90 transition active:scale-95 shrink-0"
            >
              <span>🚀 Lancer le Studio Visuel</span>
              <span>&rarr;</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── MODALE BIBLIOTHÈQUE DE MODÈLES ───────────────────────────────── */}
      {templatePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-3xl rounded-3xl border border-mist-300 bg-white p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-mist-200 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-ink">
                  ✨ Bibliothèque de Scénarios & Flow Charts Visuels
                </h3>
                <p className="text-xs text-ink-500">
                  Installez des arbres décisionnels et automatisations éprouvées en 1 clic.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTemplatePickerOpen(false)}
                className="rounded-xl p-1.5 text-ink-400 hover:text-ink hover:bg-mist"
              >
                ✕
              </button>
            </div>

            {/* Section 1 : Modèles Visuels par Nœuds (Flow Canvas) */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-lagoon-700">
                Arbres Décisionnels Visuels (Flow Builder)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {VISUAL_WORKFLOW_TEMPLATES.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="flex flex-col justify-between rounded-2xl border border-lagoon-200 bg-gradient-to-br from-lagoon-50/40 via-white to-sky-50/40 p-4 transition hover:shadow-card-hover"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-lagoon-700 mb-1">
                        <span>🎨 {tmpl.nodes.length} nœuds connectés</span>
                      </div>
                      <h4 className="font-display text-xs font-bold text-ink">{tmpl.name}</h4>
                      <p className="mt-1 text-[11px] text-ink-600 leading-relaxed">{tmpl.description}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => openVisualTemplate(tmpl)}
                      className="mt-3.5 w-full rounded-xl bg-gradient-to-r from-blue-600 to-lagoon-600 py-2 text-xs font-bold text-white transition hover:opacity-90 shadow-sm"
                    >
                      Ouvrir dans le Studio Visuel &rarr;
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2 : Scénarios Simples */}
            <div className="space-y-3 pt-3 border-t border-mist-200">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-500">
                Scénarios Rapides (Règles Linéaires)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {WORKFLOW_TEMPLATES.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="flex flex-col justify-between rounded-2xl border border-mist-200 bg-mist-50/50 p-4 transition hover:border-lagoon-300 hover:bg-white"
                  >
                    <div>
                      <h4 className="font-display text-xs font-bold text-ink">{tmpl.name}</h4>
                      <p className="mt-1 text-[11px] text-ink-500 leading-relaxed">{tmpl.description}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => addTemplate(tmpl)}
                      className="mt-3.5 w-full rounded-xl bg-lagoon-600 py-1.5 text-xs font-semibold text-white transition hover:bg-lagoon-500 shadow-sm"
                    >
                      Utiliser ce modèle &rarr;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          <SkeletonCard rows={3} />
          <SkeletonCard rows={3} />
        </div>
      )}

      {!loading && workflows.length === 0 && (
        <EmptyState
          icon="⚡"
          title="Aucun workflow pour le moment"
          description="Automatisez votre support avec des déclencheurs intelligents par mot-clé, intention IA, ou horaires."
          action={
            <button
              onClick={() => setTemplatePickerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-lagoon-600 px-4 py-2.5 text-xs font-semibold text-white shadow-glow-sm transition hover:bg-lagoon-500"
            >
              <span>✨ Explorer les modèles prêts à l'emploi</span>
            </button>
          }
        />
      )}

      {/* ── LISTE DES WORKFLOWS ACTIFS ────────────────────────────────────── */}
      {!loading && workflows.length > 0 && (
        <div className="space-y-3">
          {workflows.map((wf) => (
            <Card key={wf.id} className="p-4 transition hover:border-mist-400">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-sm font-bold text-ink">{wf.name}</h3>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                        wf.enabled ? 'bg-lagoon-100 text-lagoon-700' : 'bg-mist-200 text-ink-400'
                      )}
                    >
                      {wf.enabled ? 'Actif' : 'En pause'}
                    </span>
                    <span className="rounded-md bg-mist-100 px-2 py-0.5 text-[10.5px] font-mono text-ink-600 border border-mist-200">
                      ⚡ {wf.execution_count} exécution{wf.execution_count > 1 ? 's' : ''}
                    </span>
                    {wf.last_executed_at && (
                      <span className="text-[10.5px] text-ink-400">
                        · Dernière exécution {timeAgo(wf.last_executed_at)}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-ink-500 leading-relaxed">{wf.description}</p>

                  {/* Visual Flow Mini-Diagram */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    {/* Déclencheur */}
                    <div className="inline-flex items-center gap-1.5 rounded-xl border border-sun-300 bg-sun-50 px-2.5 py-1 text-[11px] font-semibold text-sun-700">
                      <span>⚡</span>
                      <span>
                        {wf.trigger === 'message_received' && 'Message reçu'}
                        {wf.trigger === 'intent_detected' && `Intention: ${wf.trigger_value ?? 'IA'}`}
                        {wf.trigger === 'page_visited' && `Visite: ${wf.trigger_value ?? '/page'}`}
                        {wf.trigger === 'after_hours' && 'Hors horaires'}
                        {wf.trigger === 'conversation_escalated' && 'Escalade'}
                      </span>
                    </div>

                    <span className="text-ink-300 font-bold">&rarr;</span>

                    {/* Conditions */}
                    {wf.conditions.keywords && wf.conditions.keywords.length > 0 && (
                      <>
                        <div className="inline-flex items-center gap-1 rounded-xl border border-aurora-300 bg-aurora-100/60 px-2.5 py-1 text-[11px] font-medium text-lagoon-700">
                          <span>🔍</span>
                          <span>{wf.conditions.keywords.slice(0, 3).join(', ')}</span>
                        </div>
                        <span className="text-ink-300 font-bold">&rarr;</span>
                      </>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {wf.actions.map((act, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-xl border border-lagoon-200 bg-lagoon-50 px-2 py-1 text-[11px] font-medium text-lagoon-700"
                        >
                          {act.type === 'send_message' && '💬 Réponse Auto'}
                          {act.type === 'add_tag' && `🏷️ Tag: ${act.payload}`}
                          {act.type === 'add_internal_note' && '🔒 Note Privée'}
                          {act.type === 'suggest_call' && '📞 Appel'}
                          {act.type === 'send_webhook' && '🌐 Webhook'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Switch & Actions */}
                <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
                  <label className="relative inline-flex cursor-pointer items-center" title="Activer / Désactiver">
                    <input
                      type="checkbox"
                      checked={wf.enabled}
                      onChange={() => toggleWorkflow(wf.id)}
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-mist-300 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-lagoon-600 peer-checked:after:translate-x-full" />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      // Ouvre directement dans le Flow Canvas Studio
                      const matchingVisual = visualWorkflows.find((v) => v.name.includes(wf.name.slice(0, 10))) || visualWorkflows[0];
                      setActiveVisualWf(matchingVisual);
                    }}
                    className="rounded-xl border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
                  >
                    🎨 Studio Visuel
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingWf(wf)}
                    className="rounded-xl border border-mist-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-600 hover:bg-mist transition"
                  >
                    Modifier
                  </button>

                  <button
                    type="button"
                    onClick={() => removeWorkflow(wf.id)}
                    className="rounded-xl px-2 py-1.5 text-xs text-ink-400 hover:bg-coral-50 hover:text-coral-600 transition"
                    title="Supprimer ce workflow"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
