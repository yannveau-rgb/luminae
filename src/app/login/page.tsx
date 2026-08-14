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
  if (texte.includes('invalid login credentials') || texte.includes('invalid credentials')) {
    return 'E-mail ou mot de passe incorrect.';
  }
  return err.message || 'E-mail ou mot de passe incorrect.';
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [mode, setMode] = useState<'login' | 'magic' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Déjà connecté ou retour depuis un e-mail de réinitialisation
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        if (window.location.search.includes('mode=reset') || window.location.hash.includes('type=recovery')) {
          setMode('reset');
        } else {
          router.replace('/inbox');
        }
      }
    });
  }, [router, supabase]);

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      console.error('[Luminae Auth] signInWithPassword error:', err);
      setError(messageErreur(err));
      setBusy(false);
      return;
    }
    router.replace('/inbox');
    router.refresh();
  }

  async function submitMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    const redirectUrl = `${window.location.origin}/inbox`;
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectUrl }
    });
    setBusy(false);
    if (err) {
      console.error('[Luminae Auth] signInWithOtp error:', err);
      setError(messageErreur(err));
      return;
    }
    setSuccess('Un lien de connexion directe a été envoyé à votre adresse e-mail.');
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    const redirectUrl = `${window.location.origin}/login?mode=reset`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
    setBusy(false);
    if (err) {
      console.error('[Luminae Auth] resetPasswordForEmail error:', err);
      setError(messageErreur(err));
      return;
    }
    setSuccess('Si un compte existe pour cet e-mail, un lien de réinitialisation vient d’être envoyé.');
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (err) {
      setError(err.message ?? 'Impossible de modifier le mot de passe.');
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
          <h1 className="font-display text-lg font-semibold">
            {mode === 'login'
              ? 'Espace agent'
              : mode === 'magic'
                ? 'Lien de connexion direct'
                : mode === 'forgot'
                  ? 'Mot de passe oublié'
                  : 'Nouveau mot de passe'}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {mode === 'login'
              ? 'Connectez-vous pour accéder à la boîte de réception.'
              : mode === 'magic'
                ? 'Recevez un lien par e-mail pour vous connecter en un clic sans mot de passe.'
                : mode === 'forgot'
                  ? 'Recevez un lien par e-mail pour redéfinir votre mot de passe.'
                  : 'Choisissez un nouveau mot de passe sécurisé.'}
          </p>

          {mode === 'login' && (
            <form onSubmit={submitLogin} className="mt-5 space-y-3">
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
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-600">Mot de passe</span>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setSuccess(null);
                      setMode('forgot');
                    }}
                    className="text-xs text-lagoon-600 hover:underline"
                  >
                    Oublié ?
                  </button>
                </div>
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

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                    setMode('magic');
                  }}
                  className="text-xs text-ink-500 hover:text-lagoon-600 hover:underline"
                >
                  ✨ Se connecter sans mot de passe (lien direct)
                </button>
              </div>
            </form>
          )}

          {mode === 'magic' && (
            <form onSubmit={submitMagicLink} className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600">E-mail de votre compte agent</span>
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

              {error && <p className="rounded-lg bg-coral-50 px-3 py-2 text-xs text-coral-600">{error}</p>}
              {success && <p className="rounded-lg bg-lagoon-50 px-3 py-2 text-xs text-lagoon-700">{success}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-lagoon-600 py-2.5 text-sm font-semibold text-white transition hover:bg-lagoon-700 disabled:opacity-50"
              >
                {busy ? 'Envoi…' : 'Envoyer le lien magique'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  setMode('login');
                }}
                className="w-full text-center text-xs text-ink-500 hover:text-ink hover:underline"
              >
                Retour à la connexion par mot de passe
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={submitForgot} className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600">E-mail de votre compte</span>
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

              {error && <p className="rounded-lg bg-coral-50 px-3 py-2 text-xs text-coral-600">{error}</p>}
              {success && <p className="rounded-lg bg-lagoon-50 px-3 py-2 text-xs text-lagoon-700">{success}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-lagoon-600 py-2.5 text-sm font-semibold text-white transition hover:bg-lagoon-700 disabled:opacity-50"
              >
                {busy ? 'Envoi…' : 'Envoyer le lien'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  setMode('login');
                }}
                className="w-full text-center text-xs text-ink-500 hover:text-ink hover:underline"
              >
                Retour à la connexion
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={submitReset} className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600">Nouveau mot de passe</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-mist-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-lagoon-400"
                  placeholder="••••••••"
                />
              </label>

              {error && <p className="rounded-lg bg-coral-50 px-3 py-2 text-xs text-coral-600">{error}</p>}

              <button
                type="submit"
                disabled={busy || newPassword.length < 8}
                className="w-full rounded-xl bg-lagoon-600 py-2.5 text-sm font-semibold text-white transition hover:bg-lagoon-700 disabled:opacity-50"
              >
                {busy ? 'Mise à jour…' : 'Enregistrer le mot de passe'}
              </button>
            </form>
          )}
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