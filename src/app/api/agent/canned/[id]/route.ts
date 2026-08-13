import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';

type CannedUpdate = Database['public']['Tables']['canned_responses']['Update'];

/** Vérifie qu'un agent peut modifier/supprimer une réponse : propriétaire d'une
 *  personnelle, ou admin pour une partagée. */
async function loadEditable(id: string, agentId: string, isAdmin: boolean) {
  const db = supabaseAdmin();
  const { data } = await db.from('canned_responses').select('*').eq('id', id).maybeSingle();
  if (!data) return { error: 'introuvable' as const };
  const owns = data.agent_id === agentId;
  const canEdit = data.visibility === 'shared' ? isAdmin : owns;
  if (!canEdit) return { error: 'interdit' as const };
  return { data };
}

/** PATCH /api/agent/canned/[id] — modifier une réponse prédéfinie. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const agent = await requireAgent();
    const { data: current, error: loadErr } = await loadEditable(params.id, agent.id, agent.role === 'admin');
    if (loadErr === 'introuvable') return NextResponse.json({ error: 'Réponse introuvable.' }, { status: 404 });
    if (loadErr === 'interdit') return NextResponse.json({ error: 'Action non autorisée.' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const patch: CannedUpdate = { updated_at: new Date().toISOString() };
    if (typeof body.title === 'string') patch.title = body.title.trim().slice(0, 120);
    if (typeof body.content === 'string') patch.content = body.content.trim().slice(0, 4000);
    if (typeof body.shortcode === 'string')
      patch.shortcode = body.shortcode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    if (typeof body.folder === 'string') patch.folder = body.folder.trim().slice(0, 60) || 'Général';
    if (body.visibility === 'shared' || body.visibility === 'personal') {
      if (body.visibility === 'shared' && agent.role !== 'admin') {
        return NextResponse.json({ error: 'Seul un admin peut partager une réponse.' }, { status: 403 });
      }
      patch.visibility = body.visibility;
      patch.agent_id = body.visibility === 'shared' ? null : current!.agent_id ?? agent.id;
    }

    const { data, error } = await supabaseAdmin()
      .from('canned_responses')
      .update(patch)
      .eq('id', params.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ canned: data });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[agent/canned]', err);
    return NextResponse.json({ error: 'La mise à jour a échoué.' }, { status: 500 });
  }
}

/** DELETE /api/agent/canned/[id] — supprimer une réponse prédéfinie. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const agent = await requireAgent();
    const { error: loadErr } = await loadEditable(params.id, agent.id, agent.role === 'admin');
    if (loadErr === 'introuvable') return NextResponse.json({ error: 'Réponse introuvable.' }, { status: 404 });
    if (loadErr === 'interdit') return NextResponse.json({ error: 'Action non autorisée.' }, { status: 403 });

    const { error } = await supabaseAdmin().from('canned_responses').delete().eq('id', params.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'La suppression a échoué.' }, { status: 500 });
  }
}
