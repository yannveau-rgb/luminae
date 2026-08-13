import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { broadcast } from '@/lib/broadcast';
import { notifyAgents } from '@/lib/notify';
import { chatCompletion } from '@/lib/mistral';
import { buildSummaryMessages } from '@/lib/ai-prompts';
import { signAttachments } from '@/lib/storage';
import type { Database } from '@/lib/supabase/database.types';
import type { Attachment, Conversation, Message, VisitorContext } from '@/lib/types';

type ConvUpdate = Database['public']['Tables']['conversations']['Update'];

// En dessous de ce nombre de messages visiteur/bot, la conversation est jugée
// trop courte pour justifier un résumé à la prise en charge.
const SUMMARY_MIN_MESSAGES = 4;

/**
 * Résumé de prise en charge (2-3 lignes, Mistral). Best-effort : renvoie null
 * en cas d'échec ou si la conversation est trop courte. Ne bloque jamais l'action.
 */
async function maybeSummarize(conv: Conversation): Promise<string | null> {
  if (conv.summary) return null; // déjà résumée
  const db = supabaseAdmin();
  const { data: msgs } = await db
    .from('messages')
    .select('sender, content, internal_note')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true });
  const relevant = (msgs ?? []).filter((m) => !m.internal_note && (m.sender === 'visitor' || m.sender === 'bot'));
  if (relevant.length < SUMMARY_MIN_MESSAGES) return null;

  const context: VisitorContext = {
    url: conv.source_url ?? '',
    os: conv.os ?? '',
    browser: conv.browser ?? '',
    device_type: conv.device_type ?? ''
  };
  try {
    const summary = await chatCompletion(
      buildSummaryMessages(msgs as Pick<Message, 'sender' | 'content' | 'internal_note'>[], context),
      { temperature: 0.2, maxTokens: 220 }
    );
    return summary?.trim() || null;
  } catch (err) {
    console.error('[agent/conversations] résumé', err);
    return null;
  }
}

/**
 * GET /api/agent/conversations/[id]
 * Détail d'une conversation : visiteur, messages (avec nom d'agent),
 * feedbacks sur les réponses du bot.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAgent();
    const db = supabaseAdmin();

    const { data: conv } = await db.from('conversations').select('*').eq('id', params.id).maybeSingle();
    if (!conv) {
      return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 });
    }

    const [{ data: visitor }, { data: msgs }, { data: agents }, { data: assignee }] = await Promise.all([
      db.from('visitors').select('*').eq('id', conv.visitor_id).maybeSingle(),
      db.from('messages').select('*').eq('conversation_id', conv.id).order('created_at', { ascending: true }),
      db.from('agents').select('id, full_name'),
      conv.assigned_agent_id
        ? db.from('agents').select('id, full_name').eq('id', conv.assigned_agent_id).maybeSingle()
        : Promise.resolve({ data: null })
    ]);

    const agentName = new Map((agents ?? []).map((a) => [a.id, a.full_name]));
    let messages = (msgs ?? []).map((m) => ({
      ...m,
      agent_name: m.agent_id ? agentName.get(m.agent_id) ?? null : null
    }));

    // Pièces jointes (URLs signées) rattachées aux messages.
    const msgIds = messages.map((m) => m.id);
    if (msgIds.length > 0) {
      const { data: atts } = await db.from('attachments').select('*').in('message_id', msgIds);
      if (atts && atts.length > 0) {
        const signed = await signAttachments(atts as Attachment[]);
        const byMsg = new Map<string, (Attachment & { url: string | null })[]>();
        for (const a of signed) {
          if (!a.message_id) continue;
          (byMsg.get(a.message_id) ?? byMsg.set(a.message_id, []).get(a.message_id)!).push(a);
        }
        messages = messages.map((m) => ({ ...m, attachments: byMsg.get(m.id) ?? [] }));
      }
    }

    const botIds = messages.filter((m) => m.sender === 'bot').map((m) => m.id);
    let feedback: Record<string, string> = {};
    if (botIds.length > 0) {
      const { data: fb } = await db.from('message_feedback').select('message_id, value').in('message_id', botIds);
      for (const f of fb ?? []) feedback[f.message_id] = f.value;
    }

    return NextResponse.json({
      conversation: conv,
      visitor,
      messages,
      feedback,
      assigned_agent: assignee
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[agent/conversations]', err);
    return NextResponse.json({ error: 'Impossible de charger la conversation.' }, { status: 500 });
  }
}

/**
 * PATCH /api/agent/conversations/[id]
 * Actions : take (prendre en charge), assign (assigner à un agent),
 * resolve, reopen, read (remise à zéro des non-lus).
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const agent = await requireAgent();
    const body = await req.json().catch(() => ({}));
    const { action, agent_id } = body as { action?: string; agent_id?: string };

    const db = supabaseAdmin();
    const { data: conv } = await db.from('conversations').select('*').eq('id', params.id).maybeSingle();
    if (!conv) {
      return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    let patch: ConvUpdate;
    switch (action) {
      case 'take':
        patch = { status: 'assigned', assigned_agent_id: agent.id, updated_at: now };
        break;
      case 'assign': {
        if (!agent_id) {
          return NextResponse.json({ error: 'Agent cible manquant.' }, { status: 400 });
        }
        const { data: target } = await db.from('agents').select('id').eq('id', agent_id).maybeSingle();
        if (!target) {
          return NextResponse.json({ error: 'Agent introuvable.' }, { status: 404 });
        }
        patch = { status: 'assigned', assigned_agent_id: agent_id, updated_at: now };
        break;
      }
      case 'resolve':
        patch = { status: 'resolved', resolved_at: now, updated_at: now };
        break;
      case 'reopen':
        patch = { status: 'assigned', assigned_agent_id: agent.id, resolved_at: null, updated_at: now };
        break;
      case 'read':
        patch = { unread_count: 0, updated_at: now };
        break;
      default:
        return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
    }

    // Prise en charge d'une conversation longue → résumé automatique pour l'agent.
    if (action === 'take' || action === 'assign') {
      const summary = await maybeSummarize(conv as Conversation);
      if (summary) patch.summary = summary;
    }

    const { data: fresh, error } = await db
      .from('conversations')
      .update(patch)
      .eq('id', conv.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    await broadcast(`conv:${conv.id}`, 'conversation:update', {
      id: fresh.id,
      status: fresh.status,
      assigned_agent_id: fresh.assigned_agent_id,
      resolved_at: fresh.resolved_at,
      summary: fresh.summary
    });
    await broadcast('inbox:all', 'inbox:update', { conversation_id: fresh.id });

    if (action === 'assign' && fresh.assigned_agent_id && fresh.assigned_agent_id !== agent.id) {
      await notifyAgents({
        type: 'assigned',
        title: 'Conversation assignée',
        body: `${agent.full_name ?? 'Un agent'} vous a assigné une conversation.`,
        conversationId: fresh.id,
        onlyAgentId: fresh.assigned_agent_id
      });
    }

    return NextResponse.json({ conversation: fresh });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[agent/conversations]', err);
    return NextResponse.json({ error: 'L’action n’a pas pu être effectuée.' }, { status: 500 });
  }
}