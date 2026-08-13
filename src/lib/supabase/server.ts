import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

/**
 * Client Supabase côté serveur (route handlers / server components)
 * qui lit la session de l'utilisateur depuis les cookies.
 */
export function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // En lecture seule (validation de session) : set/remove volontairement neutres.
        set() {},
        remove() {}
      }
    }
  );
}
