'use client';

/** Connexion agent/admin — Supabase Auth (e-mail + mot de passe ou lien direct). */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { BotOrb } from '@/components/widget/parts';

function messageErreur(err: { message?: string; status?: number; code?: string }): string {
  const status = err.status ?? 0;
  const code = (err.code ?? '').toLowerCase();
  const texte = (err.message ?? '').toLowerCase();

  if (status === 429 || code.includes('rate') || texte.includes('rate limit')) {
    return 'Trop de tentatives — Supabase a temporairement bloqué les connexions pour ce compte. Patientez quelques minutes avant de réessayer.';
  }
  if (code.includes('email_not_confirmed') || texte.includes('not confirmed')) {
    return 'Cette adresse n’est pas encore confirmée. Ouvrez le lien reçu par e-mail.';
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
    <main className="relative flex min-h-screen items-center justify-center aurora-dark-bg px-6 py-12">
      {/* Halo lumineux d'arrière-plan */}
      <div className="absolute h-96 w-96 rounded-full bg-aurora-500/15 blur-3xl" aria-hidden="true" />

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo & Marque */}
        <div className="mb-7 flex flex-col items-center justify-center gap-3 text-center">
          <BotOrb size={44} glow />
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-white">Luminae</h2>
            <p className="text-xs text-aurora-300 font-medium">Espace Agent & Administration</p>
          </div>
        </div>

        {/* Panneau principal en verre dépoli */}
        <div className="glass-dark rounded-3xl p-8 shadow-card-dark">
          {/* Sélecteur d'onglets de connexion */}
          {mode !== 'reset' && (
            <div className="mb-6 flex rounded-xl border border-white/10 bg-white/5 p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  setMode('login');
                }}
                className={`flex-1 rounded-lg py-2 font-medium transition ${
                  mode === 'login' ? 'bg-lagoon-600 text-white shadow-sm' : 'text-mist-400 hover:text-white'
                }`}
              >
                Mot de passe
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  setMode('magic');
                }}
                className={`flex-1 rounded-lg py-2 font-medium transition ${
                  mode === 'magic' ? 'bg-aurora-500/20 text-aurora-300' : 'text-mist-400 hover:text-white'
                }`}
              >
                ✨ Lien direct
              </button>
            </div>
          )}

          <h1 className="font-display text-lg font-semibold text-white">
            {mode === 'login'
              ? 'Connexion sécurisée'
              : mode === 'magic'
                ? 'Lien de connexion instantané'
                : mode === 'forgot'
                  ? 'Réinitialiser le mot de passe'
                  : 'Définir un nouveau mot de passe'}
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-mist-400">
            {mode === 'login'
              ? 'Accédez à votre boîte de réception et vos outils d’assistance.'
              : mode === 'magic'
                ? 'Recevez un lien sécurisé dans votre boîte mail pour vous connecter en 1 clic.'
                : mode === 'forgot'
                  ? 'Entrez votre adresse pour recevoir le lien de récupération.'
                  : 'Saisissez votre nouveau mot de passe (8 caractères minimum).'}
          </p>

          {/* Formulaire Mot de passe */}
          {mode === 'login' && (
            <form onSubmit={submitLogin} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-mist-200">Adresse e-mail</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-mist-400 outline-none transition focus:border-aurora-400 focus:bg-white/10 focus:ring-2 focus:ring-aurora-500/20"
                  placeholder="vous@exemple.fr"
                />
              </label>

              <label className="block">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-mist-200">Mot de passe</span>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setSuccess(null);
                      setMode('forgot');
                    }}
                    className="text-xs text-aurora-300 hover:underline"
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
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-mist-400 outline-none transition focus:border-aurora-400 focus:bg-white/10 focus:ring-2 focus:ring-aurora-500/20"
                  placeholder="••••••••"
                />
              </label>

              {error && (
                <p className="rounded-xl border border-coral-500/30 bg-coral-500/10 px-3.5 py-2.5 text-xs text-coral-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-lagoon-600 py-3 text-sm font-semibold text-white shadow-glow-sm transition hover:bg-lagoon-500 disabled:opacity-50"
              >
                {busy ? 'Connexion en cours…' : 'Se connecter &rarr;'}
              </button>
            </form>
          )}

          {/* Formulaire Lien Magique */}
          {mode === 'magic' && (
            <form onSubmit={submitMagicLink} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-mist-200">E-mail de votre compte agent</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-mist-400 outline-none transition focus:border-aurora-400 focus:bg-white/10 focus:ring-2 focus:ring-aurora-500/20"
                  placeholder="vous@exemple.fr"
                />
              </label>

              {error && (
                <p className="rounded-xl border border-coral-500/30 bg-coral-500/10 px-3.5 py-2.5 text-xs text-coral-300">
                  {error}
                </p>
              )}
              {success && (
                <p className="rounded-xl border border-lagoon-500/30 bg-lagoon-500/10 px-3.5 py-2.5 text-xs text-lagoon-300">
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-aurora-500 py-3 text-sm font-semibold text-ink-950 shadow-glow-sm transition hover:bg-aurora-400 disabled:opacity-50"
              >
                {busy ? 'Envoi en cours…' : 'Envoyer le lien magique'}
              </button>
            </form>
          )}

          {/* Formulaire Mot de passe oublié */}
          {mode === 'forgot' && (
            <form onSubmit={submitForgot} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-mist-200">E-mail de votre compte</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-mist-400 outline-none transition focus:border-aurora-400 focus:bg-white/10 focus:ring-2 focus:ring-aurora-500/20"
                  placeholder="vous@exemple.fr"
                />
              </label>

              {error && (
                <p className="rounded-xl border border-coral-500/30 bg-coral-500/10 px-3.5 py-2.5 text-xs text-coral-300">
                  {error}
                </p>
              )}
              {success && (
                <p className="rounded-xl border border-lagoon-500/30 bg-lagoon-500/10 px-3.5 py-2.5 text-xs text-lagoon-300">
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-lagoon-600 py-3 text-sm font-semibold text-white transition hover:bg-lagoon-500 disabled:opacity-50"
              >
                {busy ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  setMode('login');
                }}
                className="w-full text-center text-xs text-mist-400 hover:text-white hover:underline"
              >
                Retour à la connexion
              </button>
            </form>
          )}

          {/* Formulaire Nouveau mot de passe */}
          {mode === 'reset' && (
            <form onSubmit={submitReset} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-mist-200">Nouveau mot de passe</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-mist-400 outline-none transition focus:border-aurora-400 focus:bg-white/10 focus:ring-2 focus:ring-aurora-500/20"
                  placeholder="••••••••"
                />
              </label>

              {error && (
                <p className="rounded-xl border border-coral-500/30 bg-coral-500/10 px-3.5 py-2.5 text-xs text-coral-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || newPassword.length < 8}
                className="w-full rounded-xl bg-lagoon-600 py-3 text-sm font-semibold text-white transition hover:bg-lagoon-500 disabled:opacity-50"
              >
                {busy ? 'Enregistrement…' : 'Mettre à jour et accéder à l’inbox'}
              </button>
            </form>
          )}
        </div>

        {/* Retour Accueil */}
        <p className="mt-6 text-center text-xs text-mist-400">
          <Link href="/" className="transition hover:text-aurora-300">
            &larr; Retour au site public
          </Link>
        </p>
      </div>
    </main>
  );
}