'use client';

/** Connexion agent/admin — Supabase Auth (e-mail + mot de passe). */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { BotOrb } from '@/components/widget/parts';

/**
 * Traduit l'échec d'authentification en message utile.
 *
 * Un message unique « identifiants invalides » couvrait auparavant tous les cas,
 * y compris ceux où le mot de passe est correct : e-mail non confirmé, compte
 * suspendu, ou limitation de débit après plusieurs tentatives. L'agent cherchait
 * alors une faute qui n'existait pas (constat U-10).
 */
function messageErreur(err: { message?: string; status?: number; code?: string }): string {
  const status = err.status ?? 0;
  const code = (err.code ?? '').toLowerCase();
  const texte = (err.message ?? '').toLowerCase();

  if (status === 429 || code.includes('rate') || texte.includes('rate limit')) {
    return 'Trop de tentatives — Supabase a temporairement bloqué les connexions pour ce compte. Patientez quelques minutes avant de réessayer, même avec le bon mot de passe.';
  }
  if (code.includes('email_not_confirmed') || texte.includes('not confirmed')) {
    return 'Cette adresse n’est pas encore confirmée. Ouvrez le lien reçu par e-mail, ou demandez à un administrateur de confirmer le compte.';
  }
  if (texte.includes('banned') || texte.includes('suspended')) {
    return 'Ce compte est suspendu. Contactez un administrateur.';
  }
  return 'E-mail ou mot de passe incorrect.';
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Déjà connecté ? Direction la boîte de réception.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/inbox');
    });
  }, [router, supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(messageErreur(err));
      setBusy(false);
      return;
    }
    router.replace('/inbox');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-ink-900 via-ink to-ink-800 px-6">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <BotOrb size={34} glow />
          <span className="font-display text-xl font-semibold tracking-tight text-white">Luminae</span>
        </div>

        <div className="rounded-2xl bg-white p-7 shadow-panel">
          <h1 className="font-display text-lg font-semibold">Espace agent</h1>
          <p className="mt-1 text-sm text-ink-500">Connectez-vous pour accéder à la boîte de réception.</p>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-600">E-mail</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-mist-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-lagoon-400"
                placeholder="vous@exemple.fr"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-600">Mot de passe</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-mist-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-lagoon-400"
                placeholder="••••••••"
              />
            </label>

            {error && <p className="rounded-lg bg-coral-50 px-3 py-2 text-xs text-coral-600">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-lagoon-600 py-2.5 text-sm font-semibold text-white transition hover:bg-lagoon-700 disabled:opacity-50"
            >
              {busy ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-ink-300">
          <Link href="/" className="hover:text-aurora-300">
            ← Retour à l’accueil
          </Link>
        </p>
      </div>
    </main>
  );
}