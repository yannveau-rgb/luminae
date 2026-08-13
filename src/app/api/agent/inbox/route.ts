import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { htmlToText } from '@/lib/utils';

/**
 * GET /api/agent/inbox?resolved=1
 * Liste des conversations pour la boîte de réception : visiteur, dernier
 * message visible, statut, assignation et compteur non-lus.
 */
export async function GET(req: Request) {
  try {
    await requireAgent();
    const { searchParams } = new URL(req.url);
    const includeResolved = searchParams.get('resolved') === '1';

    const db = supabaseAdmin();
    let query = db.from('conversations').select('*').order('updated_at', { ascending: false }).limit(200);
    if (!includeResolved) query = query.neq('status', 'resolved');
    const { data: convs, error } = await query;
    if (error) throw new Error(error.message);
    const conversations = convs ?? [];
    if (conversations.length === 0) return NextResponse.json({ conversations: [] });

    const visitorIds = [...new Set(conversations.map((c) => c.visitor_id))];
    const agentIds = [...new Set(conversations.map((c) => c.assigned_agent_id).filter(Boolean))] as string[];
    const convIds = conversations.map((c) => c.id);

    const [{ data: visitors }, { data: assignees }, { data: msgs }] = await Promise.all([
      db.from('visitors').select('id, display_name').in('id', visitorIds),
      agentIds.length > 0 ? db.from('agents').select('id, full_name').in('id', agentIds) : Promise.resolve({ data: [] }),
      db
        .from('messages')
        .select('conversation_id, content, content_html, sender, internal_note, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false })
    ]);

    const visitorName = new Map((visitors ?? []).map((v) => [v.id, v.display_name]));
    const agentName = new Map((assignees ?? []).map((a) => [a.id, a.full_name]));

    // Dernier message « visible » par conversation (les notes internes ne comptent pas).
    const lastMessage = new Map<string, (typeof msgs extends (infer T)[] | null ? T : never)>();
    for (const m of msgs ?? []) {
      if (m.internal_note) continue;
      if (!lastMessage.has(m.conversation_id)) lastMessage.set(m.conversation_id, m);
    }

    const items = conversations.map((c) => {
      const last = lastMessage.get(c.id) ?? null;
      return {
        ...c,
        visitor_name: visitorName.get(c.visitor_id) ?? null,
        assigned_name: c.assigned_agent_id ? agentName.get(c.assigned_agent_id) ?? null : null,
        last_message: last
          ? {
              sender: last.sender,
              content: (last.content_html ? htmlToText(last.content_html) : last.content).slice(0, 160),
              created_at: last.created_at
            }
          : null
      };
    });

    return NextResponse.json({ conversations: items });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[agent/inbox]', err);
    return NextResponse.json({ error: 'Impossible de charger la boîte de réception.' }, { status: 500 });
  }
}