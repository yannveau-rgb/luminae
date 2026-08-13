import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { embedText } from '@/lib/mistral';

// L'indexation appelle Mistral article par article : laisser du temps.
export const maxDuration = 300;

/**
 * POST /api/admin/articles/reindex
 * (Ré)génère les embeddings Mistral des articles pour le RAG.
 *  - par défaut : uniquement les articles NON indexés (embedding null) ;
 *  - `{ all: true }` : ré-indexe TOUS les articles (après changement de modèle
 *    d'embeddings, par exemple). Coûte des tokens Mistral.
 * Best-effort : un échec d'embedding sur un article n'interrompt pas les autres.
 */
export async function POST(req: Request) {
  try {
    await requireAgent('admin');
    const body = await req.json().catch(() => ({}));
    const all = body?.all === true;

    const db = supabaseAdmin();
    let query = db.from('articles').select('id, title, content');
    if (!all) query = query.is('embedding', null);
    const { data: articles, error } = await query;
    if (error) throw new Error(error.message);

    let indexed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const a of articles ?? []) {
      try {
        const embedding = await embedText(`${a.title}\n\n${a.content}`);
        const { error: upErr } = await db.from('articles').update({ embedding }).eq('id', a.id);
        if (upErr) throw new Error(upErr.message);
        indexed++;
      } catch (e) {
        failed++;
        if (errors.length < 5) errors.push(`${a.title} — ${e instanceof Error ? e.message : 'échec'}`);
      }
    }

    return NextResponse.json({
      total: (articles ?? []).length,
      indexed,
      failed,
      errors
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[admin/articles/reindex]', err);
    return NextResponse.json({ error: 'La réindexation a échoué.' }, { status: 500 });
  }
}
