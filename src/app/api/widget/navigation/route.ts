import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { broadcast } from '@/lib/broadcast';
import { isUuid } from '@/lib/utils';

export const maxDuration = 30;

/**
 * POST /api/widget/navigation
 * Enregistre le changement de page du visiteur (comme dans HubSpot Chat)
 * et insère un événement système discret dans le fil de conversation.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, conversationId, url, title } = body as {
      token?: string;
      conversationId?: string;
      url?: string;
      title?: string;
    };

    if (!isUuid(token) || !isUuid(conversationId) || !url) {
      return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'URL invalide.' }, { status: 400 });
    }

    const db = supabaseAdmin();

    // Vérifier l'existence et l'appartenance de la conversation
    const { data: conv } = await db
      .from('conversations')
      .select('id, visitor_id, status, source_url')
      .eq('id', conversationId)
      .maybeSingle();

    if (!conv) {
      return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 });
    }

    // Si l'URL n'a pas changé, inutile de dupliquer l'événement
    if (conv.source_url === url) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    const cleanPath = parsedUrl.pathname + (parsedUrl.search || '');
    const cleanTitle = (title || '').trim();
    const eventText = `🧭 Page consultée : ${cleanPath}${cleanTitle ? ` · « ${cleanTitle} »` : ''}`;

    // 1. Mettre à jour l'URL source sur la conversation
    await db
      .from('conversations')
      .update({
        source_url: url,
        updated_at: new Date().toISOString()
      })
      .eq('id', conv.id);

    // 2. Insérer le message système
    const { data: msg } = await db
      .from('messages')
      .insert({
        conversation_id: conv.id,
        sender: 'system',
        content: eventText
      })
      .select('*')
      .single();

    if (msg) {
      await broadcast(`conv:${conv.id}`, 'message:new', msg);
    }

    await broadcast(`conv:${conv.id}`, 'conversation:update', {
      id: conv.id,
      source_url: url
    });

    await broadcast('inbox:all', 'inbox:update', {
      conversation_id: conv.id
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[widget/navigation]', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
