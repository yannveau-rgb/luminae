import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Json } from './supabase/database.types';

export interface RgpdRequest {
  id: string;
  visitor_id: string;
  visitor_name: string | null;
  conversation_id?: string | null;
  source_url?: string | null;
  status: 'pending' | 'processed';
  requested_at: string;
  processed_at?: string | null;
  processed_by?: string | null;
}

/**
 * Récupère la liste des demandes RGPD depuis le store bot_settings.
 */
export async function getRgpdRequests(): Promise<RgpdRequest[]> {
  try {
    const db = supabaseAdmin();
    const { data: row } = await db.from('bot_settings').select('suggestions').eq('id', 1).maybeSingle();
    const store = (row?.suggestions && typeof row.suggestions === 'object' && !Array.isArray(row.suggestions))
      ? (row.suggestions as Record<string, unknown>)
      : {};

    if (Array.isArray(store.rgpd_requests)) {
      return store.rgpd_requests as RgpdRequest[];
    }
  } catch (err) {
    console.warn('[rgpd-store] Erreur lecture demandes:', err);
  }
  return [];
}

/**
 * Enregistre une nouvelle demande d'effacement RGPD.
 */
export async function createRgpdRequest(req: {
  visitor_id: string;
  visitor_name?: string | null;
  conversation_id?: string | null;
  source_url?: string | null;
}): Promise<RgpdRequest> {
  const db = supabaseAdmin();
  const list = await getRgpdRequests();

  const newReq: RgpdRequest = {
    id: `rgpd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    visitor_id: req.visitor_id,
    visitor_name: req.visitor_name ?? 'Visiteur',
    conversation_id: req.conversation_id ?? null,
    source_url: req.source_url ?? null,
    status: 'pending',
    requested_at: new Date().toISOString()
  };

  const updated = [newReq, ...list.filter((r) => r.visitor_id !== req.visitor_id)];

  const { data: row } = await db.from('bot_settings').select('suggestions').eq('id', 1).maybeSingle();
  const store = (row?.suggestions && typeof row.suggestions === 'object' && !Array.isArray(row.suggestions))
    ? (row.suggestions as Record<string, unknown>)
    : {};

  store.rgpd_requests = updated;

  await db.from('bot_settings').update({ suggestions: store as unknown as Json }).eq('id', 1);

  return newReq;
}

/**
 * Marque une demande RGPD comme traitée.
 */
export async function markRgpdProcessed(requestId: string, agentName: string): Promise<boolean> {
  const db = supabaseAdmin();
  const list = await getRgpdRequests();
  const updated = list.map((r) =>
    r.id === requestId
      ? {
          ...r,
          status: 'processed' as const,
          processed_at: new Date().toISOString(),
          processed_by: agentName
        }
      : r
  );

  const { data: row } = await db.from('bot_settings').select('suggestions').eq('id', 1).maybeSingle();
  const store = (row?.suggestions && typeof row.suggestions === 'object' && !Array.isArray(row.suggestions))
    ? (row.suggestions as Record<string, unknown>)
    : {};

  store.rgpd_requests = updated;

  await db.from('bot_settings').update({ suggestions: store as unknown as Json }).eq('id', 1);
  return true;
}
