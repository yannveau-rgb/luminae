import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { enforce, WIDGET_RULES } from '@/lib/rate-limit';
import { isUuid } from '@/lib/utils';

/**
 * POST /api/widget/feedback
 * Vote 👍/👎 sur une réponse du bot (un vote par message, modifiable).
 *
 * Le token visiteur est exigé et doit correspondre à la conversation du message
 * voté : l'upsert porte sur `onConflict: message_id`, donc sans ce contrôle
 * n'importe qui pouvait écraser le vote de n'importe quel message et corrompre
 * les statistiques de qualité (constat S-09).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { messageId, value, token } = body as {
      messageId?: string;
      value?: string;
      token?: string;
    };
    if (!isUuid(messageId) || !isUuid(token) || (value !== 'up' && value !== 'down')) {
      return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
    }

    const limited = await enforce(WIDGET_RULES.feedback, req, token);
    if (limited) return limited;

    const db = supabaseAdmin();
    const { data: msg } = await db
      .from('messages')
      .select('id, sender, conversation_id')
      .eq('id', messageId)
      .maybeSingle();
    if (!msg || msg.sender !== 'bot') {
      return NextResponse.json({ error: 'Feedback possible uniquement sur une réponse du bot.' }, { status: 400 });
    }

    // Le votant doit être le visiteur de la conversation qui contient ce message.
    const [{ data: visitor }, { data: conv }] = await Promise.all([
      db.from('visitors').select('id').eq('token', token).maybeSingle(),
      db.from('conversations').select('id, visitor_id').eq('id', msg.conversation_id).maybeSingle()
    ]);
    if (!visitor || !conv || conv.visitor_id !== visitor.id) {
      return NextResponse.json({ error: 'Message introuvable.' }, { status: 404 });
    }

    const { error } = await db.from('message_feedback').upsert(
      { message_id: messageId, value, visitor_id: visitor.id },
      { onConflict: 'message_id' }
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[widget/feedback]', err);
    return NextResponse.json({ error: 'Le feedback n’a pas pu être enregistré.' }, { status: 500 });
  }
}
