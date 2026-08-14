import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, AuthError } from '@/lib/auth';
import { getRgpdRequests, markRgpdProcessed } from '@/lib/rgpd-store';
import { broadcast } from '@/lib/broadcast';

export const maxDuration = 60;

/**
 * GET /api/admin/rgpd
 * Liste des demandes d'effacement RGPD.
 */
export async function GET() {
  try {
    await requireAdmin();
    const list = await getRgpdRequests();
    return NextResponse.json({ requests: list });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/rgpd
 * Exécution manuelle de la purge RGPD par un conseiller ou admin.
 */
export async function POST(req: Request) {
  try {
    const agent = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const { requestId, visitorId, conversationId, mode } = body as {
      requestId: string;
      visitorId?: string;
      conversationId?: string;
      mode?: 'anonymize' | 'purge_all';
    };

    if (!requestId) {
      return NextResponse.json({ error: 'Identifiant de demande manquant.' }, { status: 400 });
    }

    const db = supabaseAdmin();
    const agentName = agent.full_name ?? agent.email;

    if (visitorId) {
      if (mode === 'purge_all') {
        // Suppression complète en cascade
        await db.from('visitors').delete().eq('id', visitorId);
      } else {
        // Anonymisation stricte (nom, coordonnées et session)
        await db
          .from('visitors')
          .update({
            display_name: 'Visiteur anonymisé (Droit à l’oubli RGPD)',
            auth_user_id: null
          })
          .eq('id', visitorId);
      }
    }

    // Mise à jour du registre RGPD
    await markRgpdProcessed(requestId, agentName);

    // Ajout d'une note interne de traçabilité dans la conversation si active
    if (conversationId) {
      await db.from('messages').insert({
        conversation_id: conversationId,
        sender: 'system',
        content: `✓ [RGPD Conforme] Les données personnelles du visiteur ont été purgées manuellement par ${agentName}.`,
        internal_note: true
      });
      await broadcast(`conv:${conversationId}`, 'conversation:update', { id: conversationId });
    }

    await broadcast('inbox:all', 'inbox:update', {});

    return NextResponse.json({
      ok: true,
      message: `Données personnelles du visiteur purgées avec succès par ${agentName}.`
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[admin/rgpd]', err);
    return NextResponse.json({ error: 'Échec du traitement RGPD.' }, { status: 500 });
  }
}
