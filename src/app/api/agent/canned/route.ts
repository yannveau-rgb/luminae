import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/agent/canned
 * Réponses prédéfinies visibles par l'agent : toutes les « partagées » + ses
 * propres réponses « personnelles ». Triées par dossier puis raccourci.
 */
export async function GET() {
  try {
    const agent = await requireAgent();
    const db = supabaseAdmin();
    const { data, error } = await db
      .from('canned_responses')
      .select('*')
      .or(`visibility.eq.shared,agent_id.eq.${agent.id}`)
      .order('folder', { ascending: true })
      .order('shortcode', { ascending: true });
    if (error) throw new Error(error.message);
    return NextResponse.json({ canned: data ?? [] });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[agent/canned]', err);
    return NextResponse.json({ error: 'Impossible de charger les réponses.' }, { status: 500 });
  }
}

/**
 * POST /api/agent/canned — créer une réponse prédéfinie.
 *  - « personnelle » : n'importe quel agent (rattachée à lui).
 *  - « partagée » : réservée aux admins.
 */
export async function POST(req: Request) {
  try {
    const agent = await requireAgent();
    const body = await req.json().catch(() => ({}));
    const title = (body.title ?? '').toString().trim().slice(0, 120);
    const content = (body.content ?? '').toString().trim().slice(0, 4000);
    const shortcode = (body.shortcode ?? '').toString().trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    const folder = (body.folder ?? '').toString().trim().slice(0, 60) || 'Général';
    const visibility = body.visibility === 'shared' ? 'shared' : 'personal';

    if (!title || !content || !shortcode) {
      return NextResponse.json({ error: 'Titre, raccourci et contenu sont requis.' }, { status: 400 });
    }
    if (visibility === 'shared' && agent.role !== 'admin') {
      return NextResponse.json({ error: 'Seul un admin peut créer une réponse partagée.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin()
      .from('canned_responses')
      .insert({
        title,
        content,
        shortcode,
        folder,
        visibility,
        agent_id: visibility === 'shared' ? null : agent.id
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ canned: data });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[agent/canned]', err);
    return NextResponse.json({ error: 'La réponse n’a pas pu être créée.' }, { status: 500 });
  }
}
