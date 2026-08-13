import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { embedText } from '@/lib/mistral';

/** GET /api/admin/articles — liste des articles + statut d'indexation. */
export async function GET() {
  try {
    await requireAgent('admin');
    const db = supabaseAdmin();
    const [{ data: articles }, { data: indexed }] = await Promise.all([
      db.from('articles').select('id, title, category, tags, created_at, updated_at').order('updated_at', { ascending: false }),
      db.from('articles').select('id').not('embedding', 'is', null)
    ]);
    const indexedIds = new Set((indexed ?? []).map((r) => r.id));
    const items = (articles ?? []).map((a) => ({ ...a, indexed: indexedIds.has(a.id) }));
    return NextResponse.json({ articles: items });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Impossible de charger les articles.' }, { status: 500 });
  }
}

/** POST /api/admin/articles — créer un article et l'indexer (embedding Mistral). */
export async function POST(req: Request) {
  try {
    const admin = await requireAgent('admin');
    const body = await req.json().catch(() => ({}));
    const { title, content, category, tags } = body as {
      title?: string;
      content?: string;
      category?: string;
      tags?: unknown;
    };

    const t = (title ?? '').toString().trim().slice(0, 160);
    const c = (content ?? '').toString().trim().slice(0, 12000);
    if (!t || !c) {
      return NextResponse.json({ error: 'Le titre et le contenu sont requis.' }, { status: 400 });
    }
    const tagList = Array.isArray(tags)
      ? tags
          .filter((x): x is string => typeof x === 'string')
          .map((x) => x.trim().toLowerCase().slice(0, 40))
          .filter(Boolean)
          .slice(0, 12)
      : [];

    // Embedding best-effort : l'article est créé même si Mistral échoue,
    // mais il reste non indexé tant qu'il n'est pas ré-enregistré.
    let embedding: number[] | null = null;
    let indexError: string | null = null;
    try {
      embedding = await embedText(`${t}\n\n${c}`);
    } catch (e) {
      indexError = e instanceof Error ? e.message : 'Erreur d’indexation.';
    }

    const { data: article, error } = await supabaseAdmin()
      .from('articles')
      .insert({ title: t, content: c, category: (category ?? '').toString().trim().slice(0, 60), tags: tagList, embedding, created_by: admin.id })
      .select('id, title, category, tags, created_at, updated_at')
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ article: { ...article, indexed: !!embedding }, indexError });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[admin/articles]', err);
    return NextResponse.json({ error: 'L’article n’a pas pu être créé.' }, { status: 500 });
  }
}