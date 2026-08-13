import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { embedText } from '@/lib/mistral';

/** GET /api/admin/articles/[id] — détail d'un article (sans le vecteur). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAgent('admin');
    const { data: article } = await supabaseAdmin()
      .from('articles')
      .select('id, title, content, category, tags, created_at, updated_at')
      .eq('id', params.id)
      .maybeSingle();
    if (!article) return NextResponse.json({ error: 'Article introuvable.' }, { status: 404 });
    const { data: indexed } = await supabaseAdmin()
      .from('articles')
      .select('id')
      .eq('id', params.id)
      .not('embedding', 'is', null)
      .maybeSingle();
    return NextResponse.json({ article: { ...article, indexed: !!indexed } });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Impossible de charger l’article.' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/articles/[id] — mise à jour ; si le titre ou le contenu
 * change, l'article est ré-indexé. En cas d'échec de l'embedding, l'ancien
 * vecteur est retiré pour éviter des réponses RAG obsolètes.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAgent('admin');
    const body = await req.json().catch(() => ({}));
    const db = supabaseAdmin();

    const { data: current } = await db.from('articles').select('id, title, content').eq('id', params.id).maybeSingle();
    if (!current) return NextResponse.json({ error: 'Article introuvable.' }, { status: 404 });

    const patch: { title?: string; content?: string; category?: string; tags?: string[]; embedding?: number[] | null } = {};
    if (typeof body.title === 'string') patch.title = body.title.trim().slice(0, 160);
    if (typeof body.content === 'string') patch.content = body.content.trim().slice(0, 12000);
    if (typeof body.category === 'string') patch.category = body.category.trim().slice(0, 60);
    if (Array.isArray(body.tags)) {
      patch.tags = body.tags
        .filter((x: unknown): x is string => typeof x === 'string')
        .map((x: string) => x.trim().toLowerCase().slice(0, 40))
        .filter(Boolean)
        .slice(0, 12);
    }

    let indexError: string | null = null;
    const textChanged =
      (patch.title !== undefined && patch.title !== current.title) ||
      (patch.content !== undefined && patch.content !== current.content);
    if (textChanged) {
      try {
        patch.embedding = await embedText(`${patch.title ?? current.title}\n\n${patch.content ?? current.content}`);
      } catch (e) {
        patch.embedding = null; // plus obsolète du tout plutôt que trompeur
        indexError = e instanceof Error ? e.message : 'Erreur d’indexation.';
      }
    }

    const { data: article, error } = await db
      .from('articles')
      .update(patch)
      .eq('id', params.id)
      .select('id, title, category, tags, created_at, updated_at')
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ article: { ...article, indexed: patch.embedding !== null }, indexError });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[admin/articles]', err);
    return NextResponse.json({ error: 'La mise à jour a échoué.' }, { status: 500 });
  }
}

/** DELETE /api/admin/articles/[id] — supprimer un article. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAgent('admin');
    const { error } = await supabaseAdmin().from('articles').delete().eq('id', params.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'La suppression a échoué.' }, { status: 500 });
  }
}