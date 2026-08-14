import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { embedText } from '@/lib/mistral';
import { parseKnowledgeFile, type ParsedArticle } from '@/lib/knowledge-importer';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/articles/import
 * Importation et conversion automatique d'un document complet (.md, .json, .csv, .txt) en articles RAG.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAgent('admin');
    const body = await req.json().catch(() => ({}));
    const { action, rawContent, fileName, mode, articles: directArticles } = body as {
      action: 'preview' | 'import';
      rawContent?: string;
      fileName?: string;
      mode?: 'append' | 'replace';
      articles?: ParsedArticle[];
    };

    let parsedArticles: ParsedArticle[] = [];

    if (Array.isArray(directArticles) && directArticles.length > 0) {
      parsedArticles = directArticles;
    } else if (typeof rawContent === 'string' && rawContent.trim()) {
      parsedArticles = parseKnowledgeFile(rawContent, fileName);
    } else {
      return NextResponse.json({ error: 'Contenu de fichier ou liste d’articles requis.' }, { status: 400 });
    }

    if (parsedArticles.length === 0) {
      return NextResponse.json({ error: 'Aucun article n’a pu être extrait de ce document.' }, { status: 400 });
    }

    // Action 1 : Prévisualisation des articles détectés
    if (action === 'preview') {
      return NextResponse.json({
        success: true,
        count: parsedArticles.length,
        articles: parsedArticles
      });
    }

    // Action 2 : Importation en base & Génération des Embeddings Mistral
    const db = supabaseAdmin();

    if (mode === 'replace') {
      // Suppression de tous les anciens articles pour remplacement intégral
      const { error: delErr } = await db.from('articles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (delErr) {
        console.warn('[import] Erreur lors de la suppression des anciens articles:', delErr.message);
      }
    }

    let indexedCount = 0;
    let failedIndexCount = 0;
    const insertedArticles: { id: string; title: string; category: string }[] = [];
    const errors: string[] = [];

    for (const item of parsedArticles) {
      const title = item.title.slice(0, 160);
      const content = item.content.slice(0, 12000);
      const category = (item.category || 'Général').slice(0, 80);
      const tags = (item.tags || []).slice(0, 10);

      // Calcul de l'embedding Mistral
      let embedding: number[] | null = null;
      try {
        embedding = await embedText(`${title}\n\n${content}`);
        indexedCount++;
      } catch (e) {
        failedIndexCount++;
        if (errors.length < 5) {
          errors.push(`${title} — ${e instanceof Error ? e.message : 'Échec embedding'}`);
        }
      }

      const { data: inserted, error: insErr } = await db
        .from('articles')
        .insert({
          title,
          content,
          category,
          tags,
          embedding,
          created_by: admin.id
        })
        .select('id, title, category')
        .single();

      if (insErr) {
        errors.push(`Erreur insertion '${title}': ${insErr.message}`);
      } else if (inserted) {
        insertedArticles.push(inserted);
      }
    }

    return NextResponse.json({
      success: true,
      count: insertedArticles.length,
      indexed: indexedCount,
      failedIndex: failedIndexCount,
      errors: errors.slice(0, 5)
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[admin/articles/import]', err);
    return NextResponse.json({ error: 'Échec de l’importation de la base de connaissances.' }, { status: 500 });
  }
}
