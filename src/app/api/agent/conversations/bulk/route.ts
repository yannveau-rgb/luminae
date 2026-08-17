import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { broadcast } from '@/lib/broadcast';
import { isUuid } from '@/lib/utils';

/**
 * POST /api/agent/conversations/bulk
 * Actions groupées sur un ensemble de conversations (ex: résolution groupée, réouverture).
 */
export async function POST(req: Request) {
  try {
    const agent = await requireAgent();
    const body = await req.json().catch(() => ({}));
    const { ids, action } = body as { ids?: string[]; action?: 'resolve' | 'reopen' | 'assign' };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Liste de conversations requise.' }, { status: 400 });
    }

    const validIds = ids.filter((id): id is string => typeof id === 'string' && isUuid(id));
    if (validIds.length === 0) {
      return NextResponse.json({ error: 'Aucun identifiant valide fourni.' }, { status: 400 });
    }

    const db = supabaseAdmin();
    const now = new Date().toISOString();

    let patch: Record<string, unknown> = {};
    if (action === 'resolve' || !action) {
      patch = { status: 'resolved', resolved_at: now, updated_at: now };
    } else if (action === 'reopen') {
      patch = { status: 'assigned', assigned_agent_id: agent.id, resolved_at: null, updated_at: now };
    } else {
      return NextResponse.json({ error: 'Action groupée non supportée.' }, { status: 400 });
    }

    // Mise à jour groupée en base de données
    const { error: updateErr } = await db
      .from('conversations')
      .update(patch)
      .in('id', validIds);

    if (updateErr) {
      console.error('[bulk-action] update error', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Notification broadcast en temps réel pour synchroniser tous les conseillers
    await broadcast('inbox:all', 'inbox:update', {
      ids: validIds,
      action: action ?? 'resolve',
      by_agent_id: agent.id
    });

    for (const id of validIds) {
      await broadcast(`conv:${id}`, 'conversation:update', {
        id,
        ...patch
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      count: validIds.length,
      action: action ?? 'resolve'
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[bulk-action]', err);
    return NextResponse.json({ error: 'Échec de l’action groupée.' }, { status: 500 });
  }
}
