import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { embedText } from '@/lib/mistral';

/**
 * POST /api/agent/articles
 * Boucle d'amélioration continue : un agent transforme sa réponse manuelle en
 * nouvel article de la base de connaissances (pré-rempli côté UI, validé/édité
 * par l'agent). L'embedding est généré à la création (best-effort).
 * Accessible aux agents ET admins (la gestion complète de la base reste admin).
 */
export async function POST(req: Request) {
  try {
    const agent = await requireAgent();
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

    let embedding: number[] | null = null;
    let indexError: string | null = null;
    try {
      embedding = await embedText(`${t}\n\n${c}`);
    } catch (e) {
      indexError = e instanceof Error ? e.message : 'Erreur d’indexation.';
    }

    const { data: article, error } = await supabaseAdmin()
      .from('articles')
      .insert({
        title: t,
        content: c,
        category: (category ?? '').toString().trim().slice(0, 60),
        tags: tagList,
        embedding,
        created_by: agent.id
      })
      .select('id, title')
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ article: { ...article, indexed: !!embedding }, indexError });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[agent/articles]', err);
    return NextResponse.json({ error: 'L’article n’a pas pu être créé.' }, { status: 500 });
  }
}
