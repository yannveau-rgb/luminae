'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

type BrowserClient = ReturnType<typeof createBrowserClient<Database>>;

let browserClient: BrowserClient | null = null;

/** Client Supabase pour le navigateur (session agent, temps réel). */
export function supabaseBrowser(): BrowserClient {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
}
