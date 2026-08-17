import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { enforce, WIDGET_RULES } from '@/lib/rate-limit';
import { isUuid } from '@/lib/utils';
import { broadcast } from '@/lib/broadcast';

/**
 * POST /api/widget/csat
 * Enregistrement de l'évaluation de satisfaction globale (CSAT 1 à 5 étoiles + commentaire)
 * lors de la résolution d'une conversation.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { conversationId, token, rating, comment } = body as {
      conversationId?: string;
      token?: string;
      rating?: number;
      comment?: string;
    };

    if (!isUuid(conversationId) || !isUuid(token) || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Requête d’évaluation invalide.' }, { status: 400 });
    }

    const limited = await enforce(WIDGET_RULES.feedback, req, token);
    if (limited) return limited;

    const db = supabaseAdmin();

    // Vérifie que le visiteur est bien l'auteur de cette conversation
    const [{ data: visitor }, { data: conv }] = await Promise.all([
      db.from('visitors').select('id, display_name').eq('token', token).maybeSingle(),
      db.from('conversations').select('id, visitor_id, status, assigned_agent_id').eq('id', conversationId).maybeSingle()
    ]);

    if (!visitor || !conv || conv.visitor_id !== visitor.id) {
      return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 });
    }

    // Recherche le dernier message de la conversation pour y attacher le feedback
    const { data: lastMsg } = await db
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastMsg) {
      const cleanComment = (comment ?? '').trim().slice(0, 500);
      const feedbackValue = cleanComment ? `csat:${rating}:${cleanComment}` : `csat:${rating}`;

      await db.from('message_feedback').upsert(
        {
          message_id: lastMsg.id,
          visitor_id: visitor.id,
          value: feedbackValue
        },
        { onConflict: 'message_id' }
      );
    }

    // Diffusion temps réel aux conseillers et superviseurs connectés
    await broadcast('inbox:all', 'csat:new', {
      conversationId,
      rating,
      comment: (comment ?? '').trim(),
      visitorName: visitor.display_name ?? 'Visiteur'
    });

    return NextResponse.json({ ok: true, rating });
  } catch (err) {
    console.error('[widget/csat]', err);
    return NextResponse.json({ error: 'L’évaluation n’a pas pu être enregistrée.' }, { status: 500 });
  }
}
