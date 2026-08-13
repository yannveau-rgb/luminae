import { supabaseAdmin } from './supabase/admin';
import { broadcast } from './broadcast';
import type { Notification } from './types';

/**
 * Crée des notifications en base et les pousse en temps réel vers chaque
 * agent concerné (respect des préférences individuelles et du mode silencieux).
 */
export async function notifyAgents(params: {
  type: Notification['type'];
  title: string;
  body?: string;
  conversationId?: string;
  /** Ne pas notifier cet agent (ex. l'auteur du message). */
  exceptAgentId?: string;
  /** Cibler un seul agent (ex. conversation déjà assignée). */
  onlyAgentId?: string;
}): Promise<void> {
  const db = supabaseAdmin();
  const { data: agents } = await db
    .from('agents')
    .select('id, notification_prefs, silent_mode');
  if (!agents || agents.length === 0) return;

  const rows = [];
  for (const agent of agents) {
    if (params.exceptAgentId && agent.id === params.exceptAgentId) continue;
    if (params.onlyAgentId && agent.id !== params.onlyAgentId) continue;
    if (agent.silent_mode) continue;
    const prefs = (agent.notification_prefs ?? {}) as Record<string, boolean>;
    if (prefs[params.type] === false) continue;
    rows.push({
      agent_id: agent.id,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      conversation_id: params.conversationId ?? null
    });
  }

  if (rows.length === 0) return;
  const { data: inserted } = await db.from('notifications').insert(rows).select('*');

  for (const n of inserted ?? []) {
    await broadcast(`agent:${n.agent_id}`, 'notification:new', n);
  }
}
