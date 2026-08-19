import { NextResponse } from 'next/server';
import { requireAgent } from '@/lib/auth';
import { chatCompletion } from '@/lib/mistral';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/translate
 * Traducteur universel temps réel pour les conseillers Luminae.
 * Traduit automatiquement un message visiteur en français ou la réponse d'un conseiller dans la langue du client.
 */
export async function POST(request: Request) {
  try {
    await requireAgent();
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    return NextResponse.json({ error: error.message ?? 'Accès refusé' }, { status: error.status ?? 403 });
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const targetLanguage = typeof body?.targetLanguage === 'string' ? body.targetLanguage.trim() : 'fr';

  if (!text) {
    return NextResponse.json({ error: 'Texte requis' }, { status: 400 });
  }

  const systemPrompt = `Tu es le traducteur universel ultra-rapide et précis pour le service client Luminae.
Traduis le message suivant vers la langue cible demandée ("${targetLanguage}").
Si la langue cible est "fr", traduis fidèlement en français courant et naturel.
Si la langue cible est "auto", traduis vers la langue du client (anglais, espagnol, allemand, italien, etc.).

RÈGLE ABSOLUE :
Renvoie UNIQUEMENT un objet JSON valide sans aucun markdown ni backtick :
{
  "detectedLanguage": "Nom de la langue source détectée (ex: Anglais, Espagnol, Allemand, Français)",
  "translatedText": "Le texte traduit de manière fluide et professionnelle"
}`;

  try {
    const raw = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      { temperature: 0.1, maxTokens: 800 }
    );

    const cleanJson = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return NextResponse.json({
      originalText: text,
      detectedLanguage: parsed.detectedLanguage || 'Inconnue',
      translatedText: parsed.translatedText || text
    });
  } catch (err: unknown) {
    console.error('[translate] Erreur:', err);
    return NextResponse.json(
      {
        originalText: text,
        detectedLanguage: 'Inconnue',
        translatedText: text
      },
      { status: 200 }
    );
  }
}
