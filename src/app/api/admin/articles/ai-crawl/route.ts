import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { chatCompletion, embedText } from '@/lib/mistral';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/articles/ai-crawl
 * Importation et Ingestion intelligente par URL pour la base de connaissances.
 * Récupère le contenu d'un site web / FAQ, nettoie le bruit et génère des articles structurés.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    return NextResponse.json({ error: error.message ?? 'Accès refusé' }, { status: error.status ?? 403 });
  }

  const body = await request.json().catch(() => null);
  const targetUrl = typeof body?.url === 'string' ? body.url.trim() : '';
  const autoSave = Boolean(body?.autoSave);

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return NextResponse.json({ error: 'URL valide requise (commençant par http:// ou https://)' }, { status: 400 });
  }

  try {
    // 1. Récupérer le contenu de la page web
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LuminaeCrawler/1.0',
        Accept: 'text/html,application/xhtml+xml,text/plain'
      },
      signal: AbortSignal.timeout(12000)
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Impossible de charger la page (HTTP ${res.status})` }, { status: 400 });
    }

    const html = await res.text();

    // 2. Nettoyer le HTML pour extraire le texte utile
    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000);

    if (cleanText.length < 50) {
      return NextResponse.json({ error: 'Contenu textuel insuffisant trouvé sur cette page.' }, { status: 400 });
    }

    // 3. Demander à Mistral de structurer en fiches de support
    const prompt = `Tu es un expert en documentation client et Knowledge Management.
Voici le texte extrait de la page web "${targetUrl}" :

"""
${cleanText}
"""

TÂCHE :
Analyse ce texte et génère entre 1 et 5 articles de base de connaissances clairs, précis et professionnels.
Chaque article doit avoir un titre percutant, une catégorie adaptée (ex: "Général", "Tarifs", "Livraison", "Support Technique"), des tags utiles et un contenu rédigé au propre en Markdown avec des sous-titres et puces.

FORMAT DE RÉPONSE STRICT (JSON uniquement sans backtick) :
{
  "siteTitle": "Nom ou sujet principal du site",
  "articles": [
    {
      "title": "Titre clair de l'article",
      "category": "Nom de la catégorie",
      "tags": ["tag1", "tag2"],
      "content": "Contenu complet rédigé en Markdown structuré..."
    }
  ]
}`;

    const raw = await chatCompletion(
      [
        { role: 'system', content: 'Tu es un générateur d’articles de support client. Réponds uniquement en JSON valide.' },
        { role: 'user', content: prompt }
      ],
      { temperature: 0.2, maxTokens: 2000 }
    );

    const cleanJson = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    const articlesList: Array<{ title: string; category: string; tags: string[]; content: string }> = Array.isArray(parsed.articles) ? parsed.articles : [];

    // 4. Si autoSave est activé, insérer directement dans la base Supabase
    if (autoSave && articlesList.length > 0) {
      const db = supabaseAdmin();
      for (const art of articlesList) {
        let embedding: number[] | null = null;
        try {
          embedding = await embedText(`${art.title}\n\n${art.content}`);
        } catch {
          // embedding optionnel
        }

        await db.from('articles').insert({
          title: art.title,
          category: art.category || 'Général',
          tags: art.tags || [],
          content: art.content,
          embedding
        });
      }
    }

    return NextResponse.json({
      siteTitle: parsed.siteTitle || 'Site Web',
      articles: articlesList,
      saved: autoSave
    });
  } catch (err: unknown) {
    console.error('[ai-crawl] Erreur:', err);
    return NextResponse.json({ error: 'Erreur lors du traitement de l’URL par l’IA.' }, { status: 500 });
  }
}
