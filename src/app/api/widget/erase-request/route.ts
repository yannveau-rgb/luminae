import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createRgpdRequest } from '@/lib/rgpd-store';
import { notifyAgents } from '@/lib/notify';
import { broadcast } from '@/lib/broadcast';
import { isUuid } from '@/lib/utils';

export const maxDuration = 60;

/**
 * POST /api/widget/erase-request
 * Soumission d'une demande de droit à l'effacement RGPD supervisée.
 * Accessible uniquement si le visiteur a communiqué des données nominatives.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, conversationId } = body as { token?: string; conversationId?: string };

    if (!isUuid(token)) {
      return NextResponse.json({ error: 'Session invalide.' }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data: visitor } = await db
      .from('visitors')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (!visitor) {
      return NextResponse.json({ error: 'Visiteur introuvable.' }, { status: 404 });
    }

    if (!visitor.display_name) {
      return NextResponse.json(
        {
          error: 'Aucune coordonnée nominative n’est enregistrée pour cette session (session 100% anonyme).'
        },
        { status: 400 }
      );
    }

    // Création de la demande dans le registre RGPD
    const rgpdReq = await createRgpdRequest({
      visitor_id: visitor.id,
      visitor_name: visitor.display_name,
      conversation_id: conversationId ?? null
    });

    // Insertion d'une note interne système dans la conversation si elle existe
    if (conversationId && isUuid(conversationId)) {
      await db.from('messages').insert({
        conversation_id: conversationId,
        sender: 'system',
        content: `🔒 [RGPD] Le visiteur ${visitor.display_name} a formulé une demande officielle de suppression de ses données personnelles (Droit à l'oubli). Une action manuelle de purge est requise par un conseiller ou l'administrateur.`,
        internal_note: true
      });
      await broadcast(`conv:${conversationId}`, 'message:new', {
        id: `sys_rgpd_${Date.now()}`,
        conversation_id: conversationId,
        sender: 'system',
        content: 'Votre demande d’effacement de données a été enregistrée et sera traitée manuellement par notre équipe.',
        created_at: new Date().toISOString()
      });
    }

    // Notification sonore et push à destination des agents
    await notifyAgents({
      type: 'new_message',
      title: '🔒 Demande d’effacement RGPD',
      body: `Le visiteur ${visitor.display_name} demande la purge manuelle de ses données personnelles.`,
      conversationId: conversationId ?? undefined
    });

    await broadcast('inbox:all', 'inbox:update', { conversation_id: conversationId });

    return NextResponse.json({
      ok: true,
      requestId: rgpdReq.id,
      message: 'Votre demande d’effacement a été transmise avec succès à notre équipe. Elle sera traitée manuellement dans le respect des délais RGPD.'
    });
  } catch (err: any) {
    console.error('[widget/erase-request]', err);
    return NextResponse.json(
      { error: 'Impossible de transmettre la demande d’effacement.' },
      { status: 500 }
    );
  }
}
