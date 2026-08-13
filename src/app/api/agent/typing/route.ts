import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { broadcast } from '@/lib/broadcast';
import { isUuid } from '@/lib/utils';

/**
 * POST /api/agent/typing
 * Indicateur de saisie de l'agent, diffusé au widget via le canal conversation.
 */
export async function POST(req: Request) {
  try {
    const agent = await requireAgent();
    const body = await req.json().catch(() => ({}));
    const { conversationId, on } = body as { conversationId?: string; on?: boolean };
    if (!isUuid(conversationId)) {
      return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
    }
    await broadcast(`conv:${conversationId}`, 'typing', {
      from: 'agent',
      on: !!on,
      agent_name: agent.full_name
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[agent/typing]', err);
    return NextResponse.json({ error: 'Impossible de diffuser la saisie.' }, { status: 500 });
  }
}