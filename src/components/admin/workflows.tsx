'use client';

/**
 * Gestionnaire des workflows intelligents et automatisations (Design épuré & moderne Lumen).
 * Accès direct au Studio Visuel Flow Canvas, bibliothèque de modèles et liste épurée.
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
      setNotice({ kind: 'ok', text: 'Enregistré avec succès.' });
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
      name: 'Nouveau Scénario',
      description: 'Déclenche une action selon les intentions du visiteur.',
      enabled: true,
      trigger: 'message_received',
      conditions: {
        keywords: ['aide']
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
            ? '🔒 Note interne déclenchée par le workflow.'
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

  // ── VUE DU STUDIO VISUEL PLEIN ÉCRAN ──────────────────────────────────────
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
      <form onSubmit={saveEdited} className="space-y-4 animate-fade-in max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader
            title={editingWf.name || 'Éditer le workflow'}
            description="Définissez les conditions et les actions automatisées."
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingWf(null)}
              className="rounded-xl border border-mist-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:bg-mist"
            >
              Annuler
            </button>
            <SaveButton busy={busy} label="Enregistrer" />
          </div>
        </div>

        <FormNotice kind={notice?.kind ?? 'ok'} text={notice?.text ?? null} />

        <Card className="p-4 space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom du workflow" required>
              <input
                className={inputCls}
                value={editingWf.name}
                onChange={(e) => setEditingWf({ ...editingWf, name: e.target.value })}
                required
              />
            </Field>

            <Field label="Description rapide">
              <input
                className={inputCls}
                value={editingWf.description}
                onChange={(e) => setEditingWf({ ...editingWf, description: e.target.value })}
                placeholder="Ex: Qualification lead, SAV..."
              />
            </Field>
          </div>

          {/* Déclencheur */}
          <div className="rounded-xl border border-mist-200 bg-mist-50/50 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-ink flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sun-100 text-sun-700 text-[11px] font-bold">
                  1
                </span>
                <span>⚡ Déclencheur</span>
              </p>
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
              <option value="message_received">💬 Message visiteur reçu</option>
              <option value="intent_detected">🎯 Intention spécifique détectée par l’IA</option>
              <option value="page_visited">🌐 Visite d’une page (/panier, /tarifs)</option>
              <option value="after_hours">🌙 Hors horaires d’ouverture</option>
              <option value="conversation_escalated">⚡ Escalade vers un conseiller</option>
            </select>

            {editingWf.trigger === 'intent_detected' && (
              <Field label="Intention ciblée">
                <select
                  className={inputCls}
                  value={editingWf.trigger_value ?? 'pricing_subscription'}
                  onChange={(e) => setEditingWf({ ...editingWf, trigger_value: e.target.value })}
                >
                  <option value="pricing_subscription">🎯 Tarifs, Forfaits & Devis</option>
                  <option value="orders_shipping">📦 Suivi de Commande & Livraison</option>
                  <option value="refunds_returns">↩️ Retours & Remboursements</option>
                  <option value="tech_support_access">🔧 Support Technique</option>
                  <option value="security_gdpr">🔒 Données & RGPD</option>
                </select>
              </Field>
            )}

            {editingWf.trigger === 'page_visited' && (
              <Field label="Chemin d'URL">
                <input
                  className={inputCls}
                  value={editingWf.trigger_value ?? 'panier'}
                  onChange={(e) => setEditingWf({ ...editingWf, trigger_value: e.target.value })}
                  placeholder="/panier"
                />
              </Field>
            )}
          </div>

          {/* Conditions */}
          <div className="rounded-xl border border-mist-200 bg-mist-50/50 p-3 space-y-2.5">
            <p className="text-xs font-bold text-ink flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-aurora-100 text-lagoon-700 text-[11px] font-bold">
                2
              </span>
              <span>🔍 Conditions (Mots-clés / URL)</span>
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mots-clés déclencheurs" hint="Séparés par des virgules">
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
                  placeholder="tarif, devis, problème, commande"
                />
              </Field>

              <Field label="URL contient">
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

          {/* Actions */}
          <div className="rounded-xl border border-lagoon-200 bg-lagoon-50/30 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-ink flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-lagoon-600 text-white text-[11px] font-bold">
                  3
                </span>
                <span>🚀 Actions exécutées</span>
              </p>
            </div>

            <div className="space-y-2">
              {editingWf.actions.map((act, idx) => (
                <div key={idx} className="rounded-lg border border-mist-200 bg-white p-2.5 shadow-sm space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-lagoon-700">
                      {act.type === 'send_message' && '💬 Message automatique'}
                      {act.type === 'add_tag' && '🏷️ Taguer la conversation'}
                      {act.type === 'add_internal_note' && '🔒 Note interne privée'}
                      {act.type === 'suggest_call' && '📞 Appel Quicktalk'}
                      {act.type === 'send_webhook' && '🌐 Webhook'}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeAction(idx)}
                      className="text-ink-400 hover:text-coral-600 text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>

                  {act.type === 'send_message' && (
                    <input
                      className={inputCls}
                      value={act.payload ?? ''}
                      onChange={(e) => updateAction(idx, e.target.value)}
                      placeholder="Texte du message..."
                      required
                    />
                  )}

                  {act.type === 'add_tag' && (
                    <input
                      className={inputCls}
                      value={act.payload ?? ''}
                      onChange={(e) => updateAction(idx, e.target.value)}
                      placeholder="Nom du tag..."
                      required
                    />
                  )}

                  {act.type === 'add_internal_note' && (
                    <input
                      className={inputCls}
                      value={act.payload ?? ''}
                      onChange={(e) => updateAction(idx, e.target.value)}
                      placeholder="Note confidentielle..."
                      required
                    />
                  )}

                  {act.type === 'suggest_call' && (
                    <input
                      className={inputCls}
                      value={act.payload ?? ''}
                      onChange={(e) => updateAction(idx, e.target.value)}
                      placeholder="Libellé du bouton d'appel..."
                    />
                  )}

                  {act.type === 'send_webhook' && (
                    <input
                      className={inputCls}
                      type="url"
                      value={act.payload ?? ''}
                      onChange={(e) => updateAction(idx, e.target.value)}
                      placeholder="URL Webhook..."
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-1 pt-1">
              <button
                type="button"
                onClick={() => addAction('send_message')}
                className="rounded-lg border border-mist-300 bg-white px-2 py-1 text-[11px] font-semibold text-ink-700 hover:bg-mist"
              >
                + 💬 Message
              </button>
              <button
                type="button"
                onClick={() => addAction('add_tag')}
                className="rounded-lg border border-mist-300 bg-white px-2 py-1 text-[11px] font-semibold text-ink-700 hover:bg-mist"
              >
                + 🏷️ Tag
              </button>
              <button
                type="button"
                onClick={() => addAction('add_internal_note')}
                className="rounded-lg border border-mist-300 bg-white px-2 py-1 text-[11px] font-semibold text-ink-700 hover:bg-mist"
              >
                + 🔒 Note
              </button>
              <button
                type="button"
                onClick={() => addAction('suggest_call')}
                className="rounded-lg border border-mist-300 bg-white px-2 py-1 text-[11px] font-semibold text-ink-700 hover:bg-mist"
              >
                + 📞 Appel
              </button>
              <button
                type="button"
                onClick={() => addAction('send_webhook')}
                className="rounded-lg border border-mist-300 bg-white px-2 py-1 text-[11px] font-semibold text-ink-700 hover:bg-mist"
              >
                + 🌐 Webhook
              </button>
            </div>
          </div>
        </Card>
      </form>
    );
  }

  // ── VUE LISTE DES WORKFLOWS (ÉPURÉE & AÉRÉE) ───────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in max-w-5xl mx-auto">
      {/* En-tête sobre */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-mist-200 pb-3.5">
        <div>
          <h2 className="font-display text-base font-bold text-ink">Workflows & Automatisations</h2>
          <p className="text-xs text-ink-500">
            Concevez et pilotez vos arbres conversationnels et règles de routage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Bouton principal pour ouvrir le Studio Visuel */}
          <button
            type="button"
            onClick={() => setActiveVisualWf(visualWorkflows[0] || VISUAL_WORKFLOW_TEMPLATES[0])}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-lagoon-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-90 transition active:scale-95"
          >
            <span>🎨</span>
            <span>Studio Visuel (Flow Canvas)</span>
          </button>

          <button
            type="button"
            onClick={() => setTemplatePickerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-mist-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:bg-mist active:scale-95"
          >
            <span>✨ Modèles</span>
          </button>

          <button
            type="button"
            onClick={createNew}
            className="inline-flex items-center gap-1 rounded-xl bg-white border border-mist-300 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-mist transition active:scale-95"
          >
            + Nouveau
          </button>
        </div>
      </div>

      <FormNotice kind={notice?.kind ?? 'ok'} text={notice?.text ?? null} />

      {/* ── MODALE MODÈLES ─────────────────────────────────────────────────── */}
      {templatePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-mist-300 bg-white p-5 shadow-2xl space-y-3.5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-mist-200 pb-2.5">
              <div>
                <h3 className="font-display text-sm font-bold text-ink">
                  ✨ Modèles Prêts à l'Emploi
                </h3>
                <p className="text-[11px] text-ink-500">
                  Chargez un arbre visuel ou une règle en 1 clic.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTemplatePickerOpen(false)}
                className="rounded-lg p-1 text-ink-400 hover:text-ink hover:bg-mist"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {VISUAL_WORKFLOW_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="flex flex-col justify-between rounded-xl border border-mist-200 bg-mist-50/40 p-3 transition hover:border-lagoon-300 hover:bg-white"
                >
                  <div>
                    <div className="text-[10px] font-bold text-lagoon-700 mb-0.5">
                      🎨 {tmpl.nodes.length} blocs
                    </div>
                    <h4 className="font-display text-xs font-bold text-ink">{tmpl.name}</h4>
                    <p className="mt-1 text-[11px] text-ink-500 line-clamp-2 leading-relaxed">
                      {tmpl.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openVisualTemplate(tmpl)}
                    className="mt-2.5 w-full rounded-lg bg-lagoon-600 py-1.5 text-xs font-semibold text-white transition hover:bg-lagoon-500 shadow-sm"
                  >
                    Ouvrir &rarr;
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
        </div>
      )}

      {!loading && workflows.length === 0 && (
        <EmptyState
          icon="⚡"
          title="Aucun workflow actif"
          description="Créez votre premier scénario ou choisissez un modèle prêt à l'emploi."
          action={
            <button
              onClick={() => setTemplatePickerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-lagoon-600 px-3.5 py-2 text-xs font-semibold text-white shadow-glow-sm transition hover:bg-lagoon-500"
            >
              <span>✨ Explorer les modèles</span>
            </button>
          }
        />
      )}

      {/* ── LISTE ÉPURÉE DES WORKFLOWS ────────────────────────────────────── */}
      {!loading && workflows.length > 0 && (
        <div className="space-y-2">
          {workflows.map((wf) => (
            <Card key={wf.id} className="p-3 transition hover:border-mist-400 bg-white/90">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full shrink-0',
                        wf.enabled ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-mist-400'
                      )}
                    />
                    <h3 className="font-display text-xs font-bold text-ink truncate">{wf.name}</h3>
                    <span className="text-[10px] text-ink-400 font-mono">
                      · {wf.execution_count} exec
                    </span>
                  </div>

                  <p className="text-[11px] text-ink-500 truncate">{wf.description}</p>
                </div>

                {/* Boutons d'actions compacts */}
                <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => {
                      const matchingVisual =
                        visualWorkflows.find((v) => v.name.includes(wf.name.slice(0, 8))) ||
                        visualWorkflows[0];
                      setActiveVisualWf(matchingVisual);
                    }}
                    className="rounded-lg border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition"
                  >
                    🎨 Studio
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingWf(wf)}
                    className="rounded-lg border border-mist-200 bg-white px-2 py-1 text-[11px] font-semibold text-ink-600 hover:bg-mist transition"
                  >
                    Éditer
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleWorkflow(wf.id)}
                    className={cn(
                      'rounded-lg px-2 py-1 text-[10.5px] font-semibold transition',
                      wf.enabled
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-mist-100 text-ink-500 hover:bg-mist-200'
                    )}
                  >
                    {wf.enabled ? 'Actif' : 'Pause'}
                  </button>

                  <button
                    type="button"
                    onClick={() => removeWorkflow(wf.id)}
                    className="rounded-lg p-1 text-ink-300 hover:text-coral-600 transition"
                    title="Supprimer"
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
