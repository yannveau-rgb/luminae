import { NextResponse } from 'next/server';
import { eraseVisitor } from '@/lib/retention';
import { enforce, WIDGET_RULES } from '@/lib/rate-limit';
import { isUuid } from '@/lib/utils';

export const maxDuration = 60;

/**
 * POST /api/widget/erase
 * Droit à l'effacement : le visiteur supprime son historique et ses données.
 *
 * Le token suffit à s'autoriser — c'est déjà lui qui donne accès à l'historique
 * en lecture, l'effacement n'élargit donc aucune surface. Irréversible : la
 * confirmation est demandée côté widget.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token } = body as { token?: string };
    if (!isUuid(token)) {
      return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
    }

    const limited = await enforce(WIDGET_RULES.erase, req, token);
    if (limited) return limited;

    const rapport = await eraseVisitor(token);
    if (!rapport) {
      // Rien à effacer : réponse identique au succès, pour ne pas révéler
      // si un token existe ou non.
      return NextResponse.json({ ok: true, conversations: 0 });
    }

    return NextResponse.json({ ok: true, conversations: rapport.conversations });
  } catch (err) {
    console.error('[widget/erase]', err);
    return NextResponse.json({ error: 'La suppression n’a pas pu être effectuée.' }, { status: 500 });
  }
}
