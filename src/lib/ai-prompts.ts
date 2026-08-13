import type { BotSettings, Conversation, Message, VisitorContext } from './types';
import type { ChatMessage } from './mistral';
import type { RetrievedArticle } from './rag';

/**
 * Construction des prompts Mistral : réponse du bot, résumé de prise en
 * charge, suggestion Copilot. Le bot reste strictement ancré sur la base
 * de connaissances (pas d'invention) grâce au protocole [[NO_ANSWER]].
 */

export const NO_ANSWER = '[[NO_ANSWER]]';

export function botSystemPrompt(settings: BotSettings): string {
  const tone =
    settings.tone === 'formal'
      ? 'un vouvoiement systématique, un ton professionnel et courtois'
      : 'un ton chaleureux et détendu ; tu peux tutoyer si le visiteur tutoie';
  const length =
    settings.reply_length === 'concise'
      ? '2 à 3 phrases maximum, sans préambule'
      : settings.reply_length === 'detailed'
        ? 'une réponse détaillée et structurée, sans dépasser ~150 mots'
        : 'un paragraphe clair de 2 à 5 phrases';
  const smallTalk = settings.small_talk_enabled
    ? 'Tu peux échanger brièvement de façon informelle (salutations, remerciements), tout en restant concis et utile.'
    : 'Limite-toi strictement aux questions factuelles ; pour une simple salutation, réponds très brièvement puis invite à poser la question.';

  return [
    `Tu es « ${settings.bot_name} », l'assistant virtuel du support client.`,
    'Règles impératives :',
    `1. Réponds UNIQUEMENT en t'appuyant sur les articles de la base de connaissances fournis ci-dessous. N'invente jamais une information absente de ces articles (dates, procédures, contacts…).`,
    `2. Si les articles fournis ne permettent pas de répondre de façon fiable et complète, réponds EXACTEMENT : ${NO_ANSWER} — et rien d'autre.`,
    `3. Adopte ${tone}.`,
    `4. Longueur : ${length}.`,
    '5. Réponds en français, en texte brut (pas de markdown, pas de listes à puces en caractères spéciaux).',
    `6. ${smallTalk}`
  ].join('\n');
}

export function buildBotMessages(params: {
  settings: BotSettings;
  articles: RetrievedArticle[];
  history: Pick<Message, 'sender' | 'content'>[];
  question: string;
  context: VisitorContext | null;
}): ChatMessage[] {
  const { settings, articles, history, question, context } = params;

  const articleBlock = articles
    .map((a, i) => `[${i + 1}] ${a.title} (catégorie : ${a.category})\n${a.content}`)
    .join('\n\n');

  const historyBlock = history
    .filter((m) => m.sender === 'visitor' || m.sender === 'bot')
    .slice(-6)
    .map((m) => `${m.sender === 'visitor' ? 'Visiteur' : 'Assistant'} : ${m.content}`)
    .join('\n');

  const ctx = context
    ? `Page visitée : ${context.url} — appareil : ${context.device_type}, OS : ${context.os}, navigateur : ${context.browser}.`
    : '';

  const user = [
    'ARTICLES DE LA BASE DE CONNAISSANCES (du plus pertinent au moins pertinent) :',
    articleBlock || '(aucun article trouvé)',
    ctx && `CONTEXTE : ${ctx}`,
    historyBlock && `HISTORIQUE RÉCENT :\n${historyBlock}`,
    `QUESTION DU VISITEUR :\n${question}`
  ]
    .filter(Boolean)
    .join('\n\n');

  return [
    { role: 'system', content: botSystemPrompt(settings) },
    { role: 'user', content: user }
  ];
}

/** Détection des messages purement conversationnels (salut / merci). */
const GREETING_RE = /^(bonjour|bonsoir|salut|hello|coucou|hey|yo|bjr|slt|cc|hi)\b[\s!.?é]*$/i;
const THANKS_RE = /^(merci beaucoup|merci bien|merci|thanks|thank you|top|super|parfait|génial)\b[\s!.?]*$/i;

export function smallTalkKind(text: string): 'greeting' | 'thanks' | null {
  const t = text.trim();
  if (GREETING_RE.test(t)) return 'greeting';
  if (THANKS_RE.test(t)) return 'thanks';
  return null;
}

/** Résumé de conversation pour la prise en charge agent (2-3 lignes). */
export function buildSummaryMessages(
  messages: Pick<Message, 'sender' | 'content' | 'internal_note'>[],
  context: VisitorContext | null
): ChatMessage[] {
  const transcript = messages
    .filter((m) => !m.internal_note)
    .map((m) => {
      const who =
        m.sender === 'visitor' ? 'Visiteur' : m.sender === 'bot' ? 'Bot' : m.sender === 'agent' ? 'Agent' : 'Système';
      return `${who} : ${m.content}`;
    })
    .join('\n');

  return [
    {
      role: 'system',
      content:
        'Tu résumes une conversation de support client pour un agent qui la prend en charge. ' +
        'Produis 2 à 3 phrases factuelles en français : la demande du visiteur, les informations déjà échangées, et la situation actuelle. ' +
        'Texte brut, sans préambule, sans liste.'
    },
    {
      role: 'user',
      content: `${context ? `Contexte : page ${context.url}, appareil ${context.device_type}, OS ${context.os}, navigateur ${context.browser}.\n\n` : ''}CONVERSATION :\n${transcript}`
    }
  ];
}

/** Suggestion de réponse pour le Copilot agent. */
export function buildCopilotMessages(params: {
  settings: BotSettings;
  conversation: Conversation;
  messages: Pick<Message, 'sender' | 'content' | 'internal_note'>[];
  articles: RetrievedArticle[];
}): ChatMessage[] {
  const { settings, conversation, messages, articles } = params;

  const transcript = messages
    .filter((m) => !m.internal_note)
    .map((m) => {
      const who =
        m.sender === 'visitor' ? 'Visiteur' : m.sender === 'bot' ? 'Bot' : m.sender === 'agent' ? 'Agent' : 'Système';
      return `${who} : ${m.content}`;
    })
    .join('\n');

  const articleBlock = articles
    .map((a, i) => `[${i + 1}] ${a.title}\n${a.content}`)
    .join('\n\n');

  const tone = settings.tone === 'formal' ? 'professionnel, vouvoiement' : 'chaleureux et direct';

  return [
    {
      role: 'system',
      content:
        'Tu es le copilote IA d’un agent de support client. Rédige UNE réponse prête à être envoyée au visiteur, au nom de l’agent. ' +
        `Base-toi sur les articles fournis et l'historique ; n'invente rien. Ton ${tone}, en français, texte brut, longueur raisonnable (2 à 6 phrases). ` +
        'Ne commence pas par « Bonjour » si la conversation est déjà avancée.'
    },
    {
      role: 'user',
      content: [
        `CONTEXTE DU VISITEUR : page ${conversation.source_url ?? 'inconnue'}, appareil ${conversation.device_type ?? '?'}, OS ${conversation.os ?? '?'}, navigateur ${conversation.browser ?? '?'}.`,
        articleBlock && `ARTICLES PERTINENTS :\n${articleBlock}`,
        `HISTORIQUE COMPLET :\n${transcript}`,
        'Rédige maintenant la réponse de l’agent (texte prêt à envoyer, sans commentaire autour).'
      ]
        .filter(Boolean)
        .join('\n\n')
    }
  ];
}
