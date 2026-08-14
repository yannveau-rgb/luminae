/** Moteur d'évaluation et d'exécution des workflows intelligents Luminae. */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { type WorkflowRule, WORKFLOW_TEMPLATES } from './workflow-types';
import { classifyConversationIntent } from './intent-classifier';

interface WorkflowContext {
  conversationId: string;
  visitorMessage: string;
  sourceUrl?: string | null;
  isOffline?: boolean;
}

interface WorkflowExecutionResult {
  matchedRules: WorkflowRule[];
  botReplies: string[];
  internalNotes: string[];
  tags: string[];
  suggestCall: boolean;
  assignedAgentId?: string | null;
}

/**
 * Charge les règles de workflow depuis bot_settings ou utilise les modèles par défaut.
 */
export async function getActiveWorkflows(): Promise<WorkflowRule[]> {
  try {
    const db = supabaseAdmin();
    const { data: row } = await db.from('bot_settings').select('suggestions').eq('id', 1).maybeSingle();
    const store = (row?.suggestions && typeof row.suggestions === 'object' && !Array.isArray(row.suggestions))
      ? (row.suggestions as Record<string, unknown>)
      : {};

    if (Array.isArray(store.workflows) && store.workflows.length > 0) {
      return store.workflows as WorkflowRule[];
    }
  } catch (err) {
    console.warn('[workflow-engine] Impossible de charger les workflows:', err);
  }
  return WORKFLOW_TEMPLATES;
}

/**
 * Évalue et exécute les workflows correspondants au contexte d'un message visiteur.
 */
export async function evaluateWorkflows(ctx: WorkflowContext): Promise<WorkflowExecutionResult> {
  const result: WorkflowExecutionResult = {
    matchedRules: [],
    botReplies: [],
    internalNotes: [],
    tags: [],
    suggestCall: false
  };

  const workflows = await getActiveWorkflows();
  const enabledWorkflows = workflows.filter((w) => w.enabled);
  if (enabledWorkflows.length === 0) return result;

  const normMsg = (ctx.visitorMessage || '').toLowerCase();
  const normUrl = (ctx.sourceUrl || '').toLowerCase();
  const detectedIntent = classifyConversationIntent(ctx.visitorMessage, ctx.sourceUrl);

  for (const wf of enabledWorkflows) {
    let matched = false;

    // Évaluation du déclencheur
    if (wf.trigger === 'message_received') {
      matched = true;
    } else if (wf.trigger === 'intent_detected') {
      if (wf.trigger_value && detectedIntent.id === wf.trigger_value) {
        matched = true;
      }
    } else if (wf.trigger === 'after_hours') {
      if (ctx.isOffline) {
        matched = true;
      }
    }

    // Évaluation des conditions de filtrage
    if (matched && wf.conditions) {
      if (wf.conditions.keywords && wf.conditions.keywords.length > 0) {
        const hasKw = wf.conditions.keywords.some((kw) => normMsg.includes(kw.toLowerCase().trim()));
        if (!hasKw && wf.trigger !== 'intent_detected') {
          matched = false;
        }
      }

      if (matched && wf.conditions.url_contains) {
        if (!normUrl.includes(wf.conditions.url_contains.toLowerCase().trim())) {
          matched = false;
        }
      }

      if (matched && wf.conditions.is_offline !== undefined) {
        if (wf.conditions.is_offline !== ctx.isOffline) {
          matched = false;
        }
      }
    }

    // Si la règle correspond, on enregistre les actions
    if (matched) {
      result.matchedRules.push(wf);

      for (const act of wf.actions) {
        if (act.type === 'send_message' && act.payload) {
          result.botReplies.push(act.payload);
        } else if (act.type === 'add_internal_note' && act.payload) {
          result.internalNotes.push(act.payload);
        } else if (act.type === 'add_tag' && act.payload) {
          result.tags.push(act.payload);
        } else if (act.type === 'suggest_call') {
          result.suggestCall = true;
        } else if (act.type === 'assign_agent' && act.payload) {
          result.assignedAgentId = act.payload;
        }
      }
    }
  }

  return result;
}
