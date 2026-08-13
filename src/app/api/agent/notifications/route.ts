import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/agent/notifications — notifications non lues de l'agent connecté.
 * POST /api/agent/notifications — { id? } marque une notification (ou tout) comme lue.
 */
export async function GET() {
  try {
    const agent = await requireAgent();
    const db = supabaseAdmin();
    const { data, error } = await db
      .from('notifications')
      .select('*')
      .eq('agent_id', agent.id)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return NextResponse.json({ notifications: data ?? [] });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[agent/notifications]', err);
    return NextResponse.json({ error: 'Impossible de charger les notifications.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const agent = await requireAgent();
    const body = await req.json().catch(() => ({}));
    const { id } = body as { id?: string };

    const db = supabaseAdmin();
    let query = db.from('notifications').update({ read: true }).eq('agent_id', agent.id);
    query = id ? query.eq('id', id) : query.eq('read', false);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[agent/notifications]', err);
    return NextResponse.json({ error: 'Impossible de mettre à jour les notifications.' }, { status: 500 });
  }
}