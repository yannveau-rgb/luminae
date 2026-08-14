'use client';

/** Gestionnaire des workflows intelligents et automatisations (Freshchat / Intercom style). */

import { useEffect, useState } from 'react';
import { Card, Field, FormNotice, SaveButton, SectionHeader, inputCls } from './parts';
import { type WorkflowRule, WORKFLOW_TEMPLATES } from '@/lib/workflow-types';
import { cn } from '@/lib/utils';

export function WorkflowsPanel() {
  const [workflows, setWorkflows] = useState<WorkflowRule[]>(WORKFLOW_TEMPLATES);
  const [editingWf, setEditingWf] = useState<WorkflowRule | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/advanced-settings?section=workflows', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((j) => {
        if (Array.isArray(j.workflows) && j.workflows.length > 0) {
          setWorkflows(j.workflows);
        }
      })
      .catch(() => {});
  }, []);

  async function saveWorkflowsList(list: WorkflowRule[]) {
    setBusy(true);
    setNotice(null);
    const res = await fetch('/api/admin/advanced-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'workflows', data: list })
    });
    if (res.ok) {
      setWorkflows(list);
      setNotice({ kind: 'ok', text: 'Workflows et automatisations enregistrés avec succès.' });
    } else {
      setNotice({ kind: 'error', text: 'Impossible d’enregistrer les workflows.' });
    }
    setBusy(false);
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
      name: 'Nouveau Workflow Automatisé',
      description: 'Déclenche une action personnalisée selon le contexte du visiteur.',
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

  // ── VUE ÉDITEUR DE WORKFLOW ────────────────────────────────────────────────
  if (editingWf) {
    return (
      <form onSubmit={saveEdited} className="space-y-4">
        <SectionHeader
          title={editingWf.name || 'Éditer le workflow'}
          description="Définissez les conditions de déclenchement et les actions automatisées exécutées par le moteur de workflow."
        />

        <Card className="p-5 space-y-4">
          <Field label="Nom du workflow">
            <input
              className={inputCls}
              value={editingWf.name}
              onChange={(e) => setEditingWf({ ...editingWf, name: e.target.value })}
              required
            />
          </Field>

          <Field label="Description / Objectif">
            <input
              className={inputCls}
              value={editingWf.description}
              onChange={(e) => setEditingWf({ ...editingWf, description: e.target.value })}
              placeholder="Ex: Qualification lead commercial"
            />
          </Field>

          {/* Déclencheur */}
          <div className="rounded-xl border border-mist-200 bg-mist-50/50 p-4 space-y-3">
            <p className="text-xs font-bold text-ink flex items-center gap-1.5">
              <span>⚡</span>
              <span>1. Déclencheur (Quand exécuter ce workflow ?)</span>
            </p>

            <select
              className={inputCls}
              value={editingWf.trigger}
              onChange={(e) =>
                setEditingWf({
                  ...editingWf,
                  trigger: e.target.value as WorkflowRule['trigger']
                })
              }
            >
              <option value="message_received">À chaque message visiteur reçu</option>
              <option value="intent_detected">Lorsqu’une intention spécifique est détectée par l’IA</option>
              <option value="after_hours">En dehors des horaires d’ouverture (Hors ligne)</option>
              <option value="conversation_escalated">Lors d’une demande d’escalade vers un conseiller</option>
            </select>

            {editingWf.trigger === 'intent_detected' && (
              <Field label="Intention cible">
                <select
                  className={inputCls}
                  value={editingWf.trigger_value ?? 'pricing_subscription'}
                  onChange={(e) => setEditingWf({ ...editingWf, trigger_value: e.target.value })}
                >
                  <option value="pricing_subscription">🎯 Tarifs, Forfaits & Devis</option>
                  <option value="results_grades">🎓 Évaluation, Note & Résultats</option>
                  <option value="tech_support_access">🔧 Support Technique & Connexion</option>
                  <option value="delays_tracking">⏱️ Délais de Traitement & Suivi</option>
                  <option value="security_gdpr">🔒 Sécurité, Données & RGPD</option>
                </select>
              </Field>
            )}
          </div>

          {/* Conditions */}
          <div className="rounded-xl border border-mist-200 bg-mist-50/50 p-4 space-y-3">
            <p className="text-xs font-bold text-ink flex items-center gap-1.5">
              <span>🔍</span>
              <span>2. Conditions de Filtrage (SI...)</span>
            </p>

            <Field label="Mots-clés déclencheurs (séparés par des virgules)">
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
                placeholder="urgent, tarif, prix, aide, note"
              />
            </Field>

            <Field label="Page / URL spécifique (optionnel)">
              <input
                className={inputCls}
                value={editingWf.conditions.url_contains ?? ''}
                onChange={(e) =>
                  setEditingWf({
                    ...editingWf,
                    conditions: { ...editingWf.conditions, url_contains: e.target.value }
                  })
                }
                placeholder="ex: /tarifs, /demo, /contact"
              />
            </Field>
          </div>

          {/* Actions */}
          <div className="rounded-xl border border-lagoon-200 bg-lagoon-50/40 p-4 space-y-3">
            <p className="text-xs font-bold text-ink flex items-center gap-1.5">
              <span>🚀</span>
              <span>3. Actions Automatisées (ALORS...)</span>
            </p>

            <Field label="Message automatique envoyé par Lumi">
              <textarea
                className={inputCls}
                rows={3}
                value={editingWf.actions.find((a) => a.type === 'send_message')?.payload ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const filtered = editingWf.actions.filter((a) => a.type !== 'send_message');
                  setEditingWf({
                    ...editingWf,
                    actions: val ? [...filtered, { type: 'send_message', payload: val }] : filtered
                  });
                }}
                placeholder="Saisissez la réponse automatique de Lumi..."
              />
            </Field>

            <Field label="Étiquette / Tag à assigner (Optionnel)">
              <input
                className={inputCls}
                value={editingWf.actions.find((a) => a.type === 'add_tag')?.payload ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const filtered = editingWf.actions.filter((a) => a.type !== 'add_tag');
                  setEditingWf({
                    ...editingWf,
                    actions: val ? [...filtered, { type: 'add_tag', payload: val }] : filtered
                  });
                }}
                placeholder="ex: Lead Commercial, Urgent, VIP"
              />
            </Field>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <SaveButton busy={busy} label="Enregistrer le workflow" />
            <button
              type="button"
              onClick={() => setEditingWf(null)}
              className="rounded-xl border border-mist-300 px-4 py-2.5 text-xs font-medium text-ink-600 transition hover:bg-mist"
            >
              Annuler
            </button>
          </div>
        </Card>
      </form>
    );
  }

  // ── VUE LISTE DES WORKFLOWS & TEMPLATES ─────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          title="Workflows Intelligents & Automatisations"
          description="Automatisez les réponses, le tagging et les actions de support client grâce à des scénarios No-Code intuitifs (SI ... ALORS ...)."
        />

        <button
          onClick={createNew}
          className="rounded-xl bg-lagoon-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-lagoon-700"
        >
          + Créer un workflow
        </button>
      </div>

      <FormNotice kind={notice?.kind ?? 'ok'} text={notice?.text ?? null} />

      {/* Liste des workflows configurés */}
      <div className="space-y-3">
        {workflows.map((wf) => (
          <Card key={wf.id} className="p-4 transition hover:border-lagoon-300">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-sm font-bold text-ink">{wf.name}</h3>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                      wf.enabled ? 'bg-lagoon-100 text-lagoon-700' : 'bg-mist-200 text-ink-400'
                    )}
                  >
                    {wf.enabled ? 'Actif' : 'Désactivé'}
                  </span>
                  <span className="rounded bg-mist px-2 py-0.5 text-[10.5px] font-mono text-ink-500">
                    ⚡ Exécuté {wf.execution_count} fois
                  </span>
                </div>

                <p className="mt-1 text-xs text-ink-600 leading-relaxed">{wf.description}</p>

                {/* Résumé des actions */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {wf.conditions.keywords && wf.conditions.keywords.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-mist-200 bg-mist-50 px-2 py-1 text-[11px] text-ink-600">
                      <span>🔍 Mots-clés :</span>
                      <span className="font-semibold">{wf.conditions.keywords.slice(0, 3).join(', ')}</span>
                    </span>
                  )}
                  {wf.actions.map((act, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-lg border border-lagoon-200 bg-lagoon-50/50 px-2 py-1 text-[11px] font-medium text-lagoon-700"
                    >
                      {act.type === 'send_message' && '💬 Message Auto'}
                      {act.type === 'add_tag' && `🏷️ Tag: ${act.payload}`}
                      {act.type === 'add_internal_note' && '🔒 Note interne'}
                      {act.type === 'suggest_call' && '📞 Appel Quicktalk'}
                    </span>
                  ))}
                </div>
              </div>

              {/* Interrupteur On/Off et Actions */}
              <div className="flex shrink-0 items-center gap-3">
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={wf.enabled}
                    onChange={() => toggleWorkflow(wf.id)}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-mist-300 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-lagoon-600 peer-checked:after:translate-x-full" />
                </label>

                <button
                  onClick={() => setEditingWf(wf)}
                  className="rounded-lg p-1.5 text-xs text-lagoon-700 hover:bg-lagoon-50"
                  title="Modifier ce workflow"
                >
                  ✏️
                </button>

                <button
                  onClick={() => removeWorkflow(wf.id)}
                  className="rounded-lg p-1.5 text-xs text-ink-400 hover:bg-coral-50 hover:text-coral-600"
                  title="Supprimer ce workflow"
                >
                  🗑️
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
