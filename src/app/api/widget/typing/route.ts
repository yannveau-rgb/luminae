import { NextResponse } from 'next/server';
import { broadcast } from '@/lib/broadcast';
import { isUuid } from '@/lib/utils';

/**
 * POST /api/widget/typing
 * Relaye l'indicateur de saisie du visiteur vers les agents (Realtime).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { conversationId, typing } = body;
  if (!isUuid(conversationId)) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
  await broadcast(`conv:${conversationId}`, 'typing', { from: 'visitor', on: Boolean(typing) });
  return NextResponse.json({ ok: true });
}
