import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { chatCompletion } from '@/lib/mistral';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await requireAgent('admin');
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { mode, title, content } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Contenu manquant' }, { status: 400 });
    }

    if (mode === 'improve') {
      const prompt = `Tu es un expert en rédaction de base de connaissances et de support client pour l'application Luminae.
Améliore et structure le texte ci-dessous au format Markdown professionnel :
- Structure claire avec titres H2 (##) et listes à puces si pertinent
- Ton professionnel, clair, chaleureux et direct
- Corrige les fautes d'orthographe et de grammaire
- N'invente pas d'informations non présentes dans le texte d'origine.
- Réponds UNIQUEMENT avec le contenu Markdown amélioré, sans formule de politesse d'introduction.

Titre de l'article : ${title || 'Non spécifié'}
Contenu d'origine :
${content}`;

      const improved = await chatCompletion(
        [{ role: 'user', content: prompt }],
        { temperature: 0.3, maxTokens: 1200 }
      );

      return NextResponse.json({ result: improved });
    }

    if (mode === 'generate_faq') {
      const prompt = `Tu es un expert en support client et FAQ.
À partir du contenu d'article suivant, génère 3 à 5 questions fréquentes (FAQ) que les clients pourraient poser, accompagnées de leurs réponses courtes et précises au format Markdown.

Titre : ${title || 'Article'}
Contenu :
${content}

Format attendu pour chaque FAQ :
### Q : [Question formulée naturellement comme un client]
[Réponse directe et concise]

Réponds UNIQUEMENT avec les Q/R en Markdown.`;

      const faq = await chatCompletion(
        [{ role: 'user', content: prompt }],
        { temperature: 0.4, maxTokens: 1000 }
      );

      return NextResponse.json({ result: faq });
    }

    if (mode === 'extract_tags') {
      const prompt = `Analyse l'article suivant et suggère :
1) Une catégorie principale (1 ou 2 mots max, ex: Livraison, Retours, Paiement, Tarifs, Compte, Technique, Commandes).
2) 4 à 6 mots-clés / tags pertinents séparés par des virgules.

Titre : ${title || ''}
Contenu : ${content.slice(0, 2000)}

Réponds UNIQUEMENT au format JSON strict :
{"category": "NomCategorie", "tags": ["tag1", "tag2", "tag3", "tag4"]}`;

      const res = await chatCompletion(
        [{ role: 'user', content: prompt }],
        { temperature: 0.2, maxTokens: 300 }
      );

      try {
        const jsonMatch = res.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { category: 'Général', tags: [] };
        return NextResponse.json({ category: parsed.category, tags: (parsed.tags || []).join(', ') });
      } catch {
        return NextResponse.json({ category: 'Général', tags: 'support, aide, faq' });
      }
    }

    return NextResponse.json({ error: 'Mode non supporté' }, { status: 400 });
  } catch (err: any) {
    console.error('[admin/articles/ai-assist] error:', err);
    return NextResponse.json({ error: err.message || 'Erreur lors de l’assistance IA' }, { status: 500 });
  }
}
