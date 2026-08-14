'use client';

/**
 * Écran affiché à un compte authentifié qui n'a pas accès à la plateforme.
 *
 * Il ne faut PAS rediriger vers /login dans ce cas : /login renvoie vers /inbox
 * dès qu'une session existe, ce qui produisait une boucle de redirection sans
 * fin ni explication. Le compte existe dans `auth.users` mais pas dans
 * `public.agents` — la seule sortie utile est de se déconnecter, ou de demander
 * à un administrateur d'ajouter le compte à l'équipe.
 */

import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { BotOrb } from '@/components/widget/parts';

export function AccessDenied({ email, message }: { email?: string | null; message: string }) {
  const router = useRouter();
  const supabase = supabaseBrowser();

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-ink-900 via-ink to-ink-800 px-6">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <BotOrb size={34} glow />
          <span className="font-display text-xl font-semibold tracking-tight text-white">Luminae</span>
        </div>

        <div className="rounded-2xl bg-white p-7 shadow-panel">
          <h1 className="font-display text-lg font-semibold">Accès non autorisé</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">{message}</p>
          {email && (
            <p className="mt-3 rounded-lg bg-mist px-3 py-2 text-xs text-ink-600">
              Connecté en tant que <span className="font-medium">{email}</span>
            </p>
          )}
          <p className="mt-3 text-sm leading-relaxed text-ink-500">
            Un administrateur doit ajouter ce compte à l’équipe depuis le back-office. Vous pouvez
            aussi vous reconnecter avec une autre adresse.
          </p>

          <button
            onClick={logout}
            className="mt-5 w-full rounded-xl bg-lagoon-600 py-2.5 text-sm font-semibold text-white transition hover:bg-lagoon-700"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </main>
  );
}
