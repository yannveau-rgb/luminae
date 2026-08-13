import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let adminClient: SupabaseClient<Database> | null = null;

/**
 * Client Supabase avec la clé service role — USAGE SERVEUR UNIQUEMENT.
 * Contourne le RLS : réservé aux routes API Next.js.
 */
export function supabaseAdmin() {
  if (!adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Variables manquantes : NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    }
    adminClient = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return adminClient;
}
