import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/utils';

/**
 * POST /api/widget/feedback
 * Vote 👍/👎 sur une réponse du bot (un vote par message, modifiable).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { messageId, value, token } = body;
    if (!isUuid(messageId) || (value !== 'up' && value !== 'down')) {
      return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data: msg } = await db.from('messages').select('id, sender').eq('id', messageId).maybeSingle();
    if (!msg || msg.sender !== 'bot') {
      return NextResponse.json({ error: 'Feedback possible uniquement sur une réponse du bot.' }, { status: 400 });
    }

    let visitorId: string | null = null;
    if (isUuid(token)) {
      const { data: v } = await db.from('visitors').select('id').eq('token', token).maybeSingle();
      visitorId = v?.id ?? null;
    }

    const { error } = await db.from('message_feedback').upsert(
      { message_id: messageId, value, visitor_id: visitorId },
      { onConflict: 'message_id' }
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[widget/feedback]', err);
    return NextResponse.json({ error: 'Le feedback n’a pas pu être enregistré.' }, { status: 500 });
  }
}
