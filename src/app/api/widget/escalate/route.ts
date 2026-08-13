import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { escalateConversation } from '@/lib/bot-engine';
import { isUuid } from '@/lib/utils';
import type { BotSettings } from '@/lib/types';

/**
 * POST /api/widget/escalate
 * Demande explicite de parler à un humain → escalade immédiate.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, conversationId } = body;
    if (!isUuid(token) || !isUuid(conversationId)) {
      return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data: visitor } = await db.from('visitors').select('id').eq('token', token).maybeSingle();
    const { data: conv } = await db
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();
    if (!visitor || !conv || conv.visitor_id !== visitor.id) {
      return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 });
    }

    if (conv.status === 'bot') {
      const { data: settings } = await db.from('bot_settings').select('*').eq('id', 1).maybeSingle();
      await escalateConversation(conv as any, settings as BotSettings, 'explicit');
    }

    const { data: fresh } = await db.from('conversations').select('id, status').eq('id', conv.id).single();
    if (!fresh) return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 });
    return NextResponse.json({ conversationId: fresh.id, status: fresh.status });
  } catch (err: any) {
    console.error('[widget/escalate]', err);
    return NextResponse.json({ error: 'L’escalade n’a pas pu être effectuée.' }, { status: 500 });
  }
}
