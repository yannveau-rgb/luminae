import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { chatCompletion } from '@/lib/mistral';
import { retrieveContext } from '@/lib/rag';
import { buildCopilotMessages } from '@/lib/ai-prompts';
import type { BotSettings, Conversation, Message, VisitorContext } from '@/lib/types';

export const maxDuration = 60;

/**
 * POST /api/agent/conversations/[id]/copilot
 * Génère une suggestion de réponse pour l'agent, ancrée sur la base de
 * connaissances (RAG sur la dernière question du visiteur) + tout l'historique.
 * N'insère rien : renvoie juste { suggestion } que l'agent utilise ou ignore.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAgent();
    const db = supabaseAdmin();

    const [{ data: conv }, { data: settings }] = await Promise.all([
      db.from('conversations').select('*').eq('id', params.id).maybeSingle(),
      db.from('bot_settings').select('*').eq('id', 1).maybeSingle()
    ]);
    if (!conv) return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 });

    const { data: msgs } = await db
      .from('messages')
      .select('sender, content, internal_note')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });
    const messages = (msgs ?? []) as Pick<Message, 'sender' | 'content' | 'internal_note'>[];

    // Dernière question du visiteur → base de la recherche RAG.
    const lastVisitor = [...messages].reverse().find((m) => m.sender === 'visitor' && !m.internal_note);
    if (!lastVisitor) {
      return NextResponse.json({ error: 'Aucune question du visiteur à traiter.' }, { status: 400 });
    }

    const botSettings = settings as BotSettings;
    const context: VisitorContext = {
      url: conv.source_url ?? '',
      os: conv.os ?? '',
      browser: conv.browser ?? '',
      device_type: conv.device_type ?? ''
    };

    const articles = await retrieveContext(lastVisitor.content, context, botSettings).catch((err) => {
      console.error('[agent/copilot] RAG', err);
      return [];
    });

    const suggestion = await chatCompletion(
      buildCopilotMessages({ settings: botSettings, conversation: conv as Conversation, messages, articles }),
      { temperature: 0.4, maxTokens: 500 }
    );

    return NextResponse.json({
      suggestion: suggestion?.trim() ?? '',
      sources: articles.map((a) => ({ id: a.id, title: a.title }))
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[agent/copilot]', err);
    return NextResponse.json({ error: 'La suggestion n’a pas pu être générée.' }, { status: 500 });
  }
}
