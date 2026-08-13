/**
 * Client API Mistral (La Plateforme) — données traitées en Union Européenne.
 * - Chat : génération des réponses du bot, résumés, suggestions Copilot.
 * - Embeddings : indexation de la base de connaissances (RAG).
 */

const API_BASE = 'https://api.mistral.ai/v1';
const EMBED_MODEL = 'mistral-embed'; // 1024 dimensions

export const CHAT_MODEL = process.env.MISTRAL_CHAT_MODEL || 'mistral-small-latest';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function apiKey(): string {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) throw new Error('MISTRAL_API_KEY manquante');
  return key;
}

async function call(endpoint: string, body: unknown): Promise<any> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Mistral API ${res.status} : ${text.slice(0, 300)}`);
  }
  return res.json();
}

/** Génération de texte. Retourne le contenu de la réponse. */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const data = await call('/chat/completions', {
    model: CHAT_MODEL,
    messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 700
  });
  return data?.choices?.[0]?.message?.content?.trim() ?? '';
}

/** Génération d'un embedding (1024 dimensions) pour un texte. */
export async function embedText(text: string): Promise<number[]> {
  const data = await call('/embeddings', {
    model: EMBED_MODEL,
    input: [text.slice(0, 8000)],
    encoding_format: 'float'
  });
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) throw new Error('Réponse embeddings Mistral invalide');
  return vec;
}
