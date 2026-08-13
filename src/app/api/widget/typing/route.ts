import { NextResponse } from 'next/server';
import { broadcast } from '@/lib/broadcast';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { enforce, WIDGET_RULES } from '@/lib/rate-limit';
import { isUuid } from '@/lib/utils';

/**
 * POST /api/widget/typing
 * Relaye l'indicateur de saisie du visiteur vers les agents (Realtime).
 *
 * Le token visiteur est exigé et rattaché à la conversation visée : sans cela,
 * quiconque connaissait un `conversationId` pouvait faire clignoter « le
 * visiteur est en train d'écrire » chez les agents (constat S-09).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { conversationId, typing, token } = body as {
      conversationId?: string;
      typing?: boolean;
      token?: string;
    };
    if (!isUuid(conversationId) || !isUuid(token)) {
      return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
    }

    const limited = await enforce(WIDGET_RULES.typing, req, token);
    if (limited) return limited;

    // La conversation doit bien appartenir au porteur du token.
    const db = supabaseAdmin();
    const [{ data: visitor }, { data: conv }] = await Promise.all([
      db.from('visitors').select('id').eq('token', token).maybeSingle(),
      db.from('conversations').select('id, visitor_id').eq('id', conversationId).maybeSingle()
    ]);
    if (!visitor || !conv || conv.visitor_id !== visitor.id) {
      return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 });
    }

    await broadcast(`conv:${conversationId}`, 'typing', { from: 'visitor', on: Boolean(typing) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[widget/typing]', err);
    return NextResponse.json({ error: 'Impossible de diffuser la saisie.' }, { status: 500 });
  }
}
