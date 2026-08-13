import { supabaseAdmin } from './supabase/admin';
import { broadcast } from './broadcast';
import { chatCompletion } from './mistral';
import { retrieveContext } from './rag';
import { wantsHumanAgent } from './human-intent';
import { buildBotMessages, NO_ANSWER, smallTalkKind } from './ai-prompts';
import { teamAvailability } from './business-hours';
import { notifyAgents } from './notify';
import type { BotSettings, Conversation, Message, VisitorContext } from './types';

/**
 * Moteur de réponse du bot.
 * Pipeline : intention humaine → small talk → RAG (seuil) → Mistral → escalade.
 * Appelé après l'insertion du message visiteur.
 */
export async function runBotPipeline(conversationId: string, visitorText: string): Promise<void> {
  const db = supabaseAdmin();
  const [{ data: conv }, { data: settings }] = await Promise.all([
    db.from('conversations').select('*').eq('id', conversationId).maybeSingle(),
    db.from('bot_settings').select('*').eq('id', 1).maybeSingle()
  ]);
  if (!conv || conv.status !== 'bot') return;
  const botSettings = settings as BotSettings;

  // 1) Demande explicite d'humain → escalade immédiate.
  if (wantsHumanAgent(visitorText)) {
    await escalateConversation(conv as Conversation, botSettings, 'explicit');
    return;
  }

  // 2) Small talk (salutations / remerciements) → réponse directe sans RAG.
  const talk = smallTalkKind(visitorText);
  if (talk) {
    const reply =
      talk === 'greeting'
        ? botSettings.small_talk_enabled
          ? `Bonjour ! Ravi de vous lire 😊 Posez-moi votre question, je fais de mon mieux pour vous aider immédiatement.`
          : `Bonjour ! Comment puis-je vous aider ?`
        : `Avec plaisir ! Si vous avez une autre question, je suis là.`;
    await insertBotMessage(conversationId, reply);
    return;
  }

  // 3) RAG — récupération du contexte pertinent.
  const context: VisitorContext | null = {
    url: conv.source_url ?? '',
    os: conv.os ?? '',
    browser: conv.browser ?? '',
    device_type: conv.device_type ?? ''
  };

  await broadcast(`conv:${conversationId}`, 'typing', { from: 'bot', on: true });

  const articles = await retrieveContext(visitorText, context, botSettings).catch((err) => {
    console.error('[bot] RAG indisponible', err);
    return [];
  });

  if (articles.length === 0) {
    await escalateConversation(conv as Conversation, botSettings, 'no_match');
    return;
  }

  // 4) Génération de la réponse.
  const { data: history } = await db
    .from('messages')
    .select('sender, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(30);

  let answer = '';
  try {
    answer = await chatCompletion(
      buildBotMessages({
        settings: botSettings,
        articles,
        history: (history ?? []) as Pick<Message, 'sender' | 'content'>[],
        question: visitorText,
        context
      }),
      { temperature: 0.35, maxTokens: 600 }
    );
  } catch (err) {
    console.error('[bot] Mistral indisponible', err);
    answer = '';
  }

  if (!answer || answer.includes(NO_ANSWER)) {
    await escalateConversation(conv as Conversation, botSettings, 'no_match');
    return;
  }

  await insertBotMessage(conversationId, answer);
}

async function insertBotMessage(conversationId: string, content: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: msg } = await db
    .from('messages')
    .insert({ conversation_id: conversationId, sender: 'bot', content })
    .select('*')
    .single();
  await broadcast(`conv:${conversationId}`, 'typing', { from: 'bot', on: false });
  await broadcast(`conv:${conversationId}`, 'message:new', msg);
}

/**
 * Escalade humaine : la conversation passe en file d'attente agent.
 * Hors horaires / aucun agent disponible → message d'attente avec l'horaire
 * de retour ; la conversation reste en file pour traitement au retour.
 */
export async function escalateConversation(
  conv: Conversation,
  settings: BotSettings,
  reason: 'explicit' | 'no_match'
): Promise<void> {
  const db = supabaseAdmin();
  const { open, availableAgents, waitPhrase } = await teamAvailability();

  const intro =
    reason === 'explicit'
      ? 'Bien sûr, je vous mets en relation avec notre équipe. '
      : '';

  let text: string;
  if (open && availableAgents.length > 0) {
    text = intro + settings.fallback_message;
  } else {
    text = `${intro}${settings.offline_message} ${waitPhrase}`;
  }

  await db
    .from('conversations')
    .update({ status: 'waiting', escalated_at: new Date().toISOString() })
    .eq('id', conv.id);

  const { data: msg } = await db
    .from('messages')
    .insert({ conversation_id: conv.id, sender: 'bot', content: text })
    .select('*')
    .single();

  await broadcast(`conv:${conv.id}`, 'typing', { from: 'bot', on: false });
  await broadcast(`conv:${conv.id}`, 'message:new', msg);
  await broadcast(`conv:${conv.id}`, 'conversation:update', {
    id: conv.id,
    status: 'waiting',
    escalated_at: new Date().toISOString()
  });
  await broadcast('inbox:all', 'inbox:update', { conversation_id: conv.id });
  await notifyAgents({
    type: 'assigned',
    title: open && availableAgents.length > 0 ? 'Nouvelle conversation en attente' : 'Conversation en file (hors horaires)',
    body: await lastVisitorText(msg, conv.id),
    conversationId: conv.id
  });
}

async function lastVisitorText(_msg: unknown, conversationId: string): Promise<string | undefined> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('messages')
    .select('content')
    .eq('conversation_id', conversationId)
    .eq('sender', 'visitor')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.content?.slice(0, 140);
}
