import { embedText } from './mistral';
import { supabaseAdmin } from './supabase/admin';
import { contextTags } from './device';
import type { BotSettings, VisitorContext } from './types';

/** Article retrouvé, avec score combiné (similarité + bonus tags contexte). */
export interface RetrievedArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  similarity: number;
  boost: number;
  score: number;
}

const TAG_BONUS = 0.08;

/**
 * Recherche RAG :
 * 1. embedding de la question (Mistral)
 * 2. similarité cosinus via pgvector (rpc match_articles)
 * 3. priorisation par tags de contexte (OS / appareil / navigateur)
 * 4. filtre sous le seuil configurable (bot_settings.rag_threshold)
 */
export async function retrieveContext(
  question: string,
  context: VisitorContext | null,
  settings: Pick<BotSettings, 'rag_threshold' | 'rag_top_k'>
): Promise<RetrievedArticle[]> {
  const embedding = await embedText(question);
  const db = supabaseAdmin();
  const { data, error } = await db.rpc('match_articles', {
    query_embedding: embedding,
    match_count: Math.max(settings.rag_top_k * 3, 12)
  });
  if (error) {
    console.error('[rag] match_articles', error.message);
    return [];
  }

  const wanted = context
    ? contextTags({ os: context.os || '', browser: context.browser || '', device_type: context.device_type || '' })
    : [];

  const scored: RetrievedArticle[] = ((data ?? []) as any[]).map((row) => {
    const tags: string[] = row.tags ?? [];
    const matching = wanted.filter((w) => w && tags.some((t) => t.toLowerCase() === w));
    const boost = matching.length * TAG_BONUS;
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category,
      tags,
      similarity: row.similarity,
      boost,
      score: row.similarity + boost
    };
  });

  return scored
    .filter((a) => a.score >= settings.rag_threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, settings.rag_top_k);
}
