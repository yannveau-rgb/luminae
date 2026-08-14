'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BotOrb } from '@/components/widget/parts';

const EMBED_SNIPPET = `<script src="https://luminae.vercel.app/embed.js"
        data-luminae-src="https://luminae.vercel.app"></script>`;

const PILLARS = [
  {
    icon: (
      <svg className="h-6 w-6 text-aurora-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Bot RAG Haute Fidélité',
    badge: 'Mistral AI',
    description:
      'Chaque question est vectorisée et confrontée à votre base de connaissances. Les réponses sont sourcées et boostées par le contexte technique du visiteur (OS, navigateur).'
  },
  {
    icon: (
      <svg className="h-6 w-6 text-lagoon-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: 'Escalade Humaine Instantanée',
    badge: 'Temps réel',
    description:
      'Détection d’intention et transfert sans couture. En un clic, un agent prend le relais avec l’historique complet et les suggestions intelligentes du Copilot.'
  },
  {
    icon: (
      <svg className="h-6 w-6 text-sun-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Souveraineté & Sécurité UE',
    badge: 'RGPD strict',
    description:
      'Données hébergées en Union Européenne (Supabase Frankfurt/Paris, Mistral EU). Aucun tracking publicitaire, sessions anonymes chiffrées et conformité native.'
  }
];

export default function HomePage() {
  const [copied, setCopied] = useState(false);
  const [activeStep, setActiveStep] = useState<'rag' | 'human' | 'copilot'>('rag');

  function copyCode() {
    navigator.clipboard.writeText(EMBED_SNIPPET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="min-h-screen aurora-dark-bg text-white selection:bg-aurora-500/30 selection:text-white">
      {/* ── Navigation ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur-xl bg-ink-950/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <BotOrb size={32} glow />
            <div className="flex items-baseline gap-2">
              <span className="font-display text-xl font-bold tracking-tight text-white">Luminae</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-aurora-400">AI Platform</span>
            </div>
          </Link>

          <nav className="flex items-center gap-3">
            <Link
              href="/widget"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white transition hover:bg-white/10 hover:border-white/25"
            >
              Tester le Widget
            </Link>
            <Link
              href="/login"
              className="rounded-xl bg-lagoon-600 px-4 py-2 text-xs font-semibold text-white shadow-glow-sm transition hover:bg-lagoon-500"
            >
              Espace Agent &rarr;
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero Principal ────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-5xl px-6 pb-20 pt-16 text-center lg:pt-24">
        {/* Badge animé */}
        <div className="inline-flex items-center gap-2 rounded-full border border-aurora-500/30 bg-aurora-500/10 px-3.5 py-1.5 text-xs font-medium text-aurora-300 shadow-glow-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aurora-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-aurora-500"></span>
          </span>
          Nouvelle Génération · RAG Mistral & Escalade Humaine
        </div>

        {/* Titre percutant */}
        <h1 className="mt-7 font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
          L&apos;IA conversationnelle
          <br />
          <span className="bg-gradient-to-r from-aurora-300 via-lagoon-300 to-white bg-clip-text text-transparent">
            qui comprend avant de répondre.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-mist-300 sm:text-lg">
          Un assistant RAG entraîné sur votre documentation, capable de relayer instantanément vos agents humains avec
          un Copilot d&apos;aide à la rédaction. Intégrable en une minute.
        </p>

        {/* Boutons d'action */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/widget"
            className="flex items-center gap-2 rounded-xl bg-lagoon-600 px-6 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:bg-lagoon-500"
          >
            <BotOrb size={20} glow={false} />
            Tester la Démo Interactive
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10 hover:border-white/30"
          >
            Accéder à la Boîte Agent
          </Link>
        </div>

        {/* ── Mockup Démonstrateur Interactif ─────────────────────────────────── */}
        <div className="relative mx-auto mt-14 max-w-4xl rounded-2xl border border-white/15 bg-ink-900/90 p-5 shadow-card-dark backdrop-blur-2xl text-left">
          {/* Barre de fenêtre */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-coral-500/80"></div>
              <div className="h-3 w-3 rounded-full bg-sun-500/80"></div>
              <div className="h-3 w-3 rounded-full bg-lagoon-500/80"></div>
              <span className="ml-2 text-xs font-mono text-mist-400">luminae-experience-preview</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveStep('rag')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  activeStep === 'rag' ? 'bg-aurora-500/20 text-aurora-300' : 'text-mist-400 hover:text-white'
                }`}
              >
                1. RAG Bot
              </button>
              <button
                type="button"
                onClick={() => setActiveStep('human')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  activeStep === 'human' ? 'bg-lagoon-500/20 text-lagoon-300' : 'text-mist-400 hover:text-white'
                }`}
              >
                2. Escalade
              </button>
              <button
                type="button"
                onClick={() => setActiveStep('copilot')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  activeStep === 'copilot' ? 'bg-sun-500/20 text-sun-300' : 'text-mist-400 hover:text-white'
                }`}
              >
                3. Copilot Agent
              </button>
            </div>
          </div>

          {/* Corps de la démo */}
          <div className="mt-5 space-y-4 font-sans text-sm">
            {activeStep === 'rag' && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-700 text-xs font-bold text-mist-200">
                    V
                  </div>
                  <div className="rounded-2xl rounded-tl-none border border-white/10 bg-ink-800 px-4 py-2.5 text-mist-100">
                    Comment configurer la politique de purge automatique des données ?
                  </div>
                </div>

                <div className="ml-10 rounded-xl border border-aurora-500/20 bg-aurora-500/10 p-3 text-xs text-aurora-300">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <span>⚡ RAG Vector Search</span>
                    <span className="rounded bg-aurora-500/20 px-1.5 py-0.5 text-[10px] text-white">Score : 0.94</span>
                  </div>
                  <p className="mt-1 text-mist-300">
                    Article matché : <em>« Politique de conservation & Purge automatique (S-11) »</em>
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <BotOrb size={28} glow />
                  <div className="rounded-2xl rounded-tl-none border border-lagoon-500/30 bg-ink-950 p-4 text-mist-100 shadow-glow-sm">
                    <p>
                      La purge automatique s&apos;exécute quotidiennement à <strong>04h00 UTC</strong>. Elle supprime les
                      conversations résolues au-delà du délai paramétré dans votre administration (par défaut 90 jours).
                    </p>
                    <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-2 text-xs text-aurora-300">
                      <span>🔗 Source : Base de connaissances Luminae</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeStep === 'human' && (
              <div className="space-y-3 animate-fade-in">
                <div className="rounded-xl border border-sun-500/30 bg-sun-500/10 p-3.5 text-xs text-sun-300">
                  <span className="font-semibold">Demande d&apos;escalade humaine</span> · Le visiteur a cliqué sur « Parler à
                  un conseiller ». La conversation passe en statut <strong>En attente</strong> avec priorité immédiate.
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lagoon-600 text-xs font-bold text-white">
                    YV
                  </div>
                  <div className="rounded-2xl rounded-tl-none border border-lagoon-500/40 bg-ink-900 p-3.5 text-mist-100">
                    <p className="font-semibold text-lagoon-300 text-xs">Yann (Agent support)</p>
                    <p className="mt-1">
                      Bonjour ! Je prends le relais de notre assistant. Je vois votre question sur la purge des données.
                      Avez-vous besoin d&apos;ajuster la durée de rétention ?
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeStep === 'copilot' && (
              <div className="space-y-3 animate-fade-in">
                <div className="rounded-xl border border-aurora-500/30 bg-ink-950 p-4 shadow-glow-sm">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-aurora-300">
                      ✨ Copilot Luminae · Proposition de réponse
                    </span>
                    <button
                      type="button"
                      className="rounded-lg bg-lagoon-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-lagoon-500"
                    >
                      Insérer dans la réponse &rarr;
                    </button>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-mist-200">
                    « Pour modifier la durée de conservation, rendez-vous dans l&apos;espace Administration &rarr; section
                    Purge, et définissez la valeur souhaitée en jours. Le cron Vercel appliquera la règle dès la nuit
                    suivante. »
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Terminal d'intégration ─────────────────────────────────────────── */}
        <div className="mx-auto mt-16 max-w-2xl rounded-2xl border border-white/15 bg-ink-950/80 p-5 text-left shadow-card-dark backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-aurora-400">
              Intégration rapide · 1 seule ligne de code
            </p>
            <button
              type="button"
              onClick={copyCode}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
            >
              {copied ? '✓ Copié !' : 'Copier le script'}
            </button>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-ink-900 p-3.5 text-xs leading-relaxed text-mist-200 font-mono">
            <code>{EMBED_SNIPPET}</code>
          </pre>
        </div>
      </section>

      {/* ── Grille des 3 Piliers ──────────────────────────────────────────────── */}
      <section className="border-t border-white/10 bg-ink-950/50 py-20 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Conçu pour l&apos;excellence opérationnelle
            </h2>
            <p className="mt-2 text-sm text-mist-400">
              La puissance de l&apos;IA générative combinée à la maîtrise humaine totale.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="group relative rounded-2xl border border-white/10 bg-ink-900/60 p-7 shadow-bubble transition duration-300 hover:border-aurora-500/40 hover:bg-ink-900/90 hover:shadow-glow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 border border-white/10 group-hover:scale-105 transition">
                    {p.icon}
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-mist-300">
                    {p.badge}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-white">{p.title}</h3>
                <p className="mt-2.5 text-xs leading-relaxed text-mist-400">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pied de page ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-ink-950 py-8 text-center text-xs text-mist-400">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-2">
            <BotOrb size={20} glow={false} />
            <span className="font-semibold text-white">Luminae</span>
            <span>· Plateforme de relation client IA</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-[11px] text-lagoon-300">
              <span className="h-2 w-2 rounded-full bg-lagoon-400 animate-pulse"></span>
              Données hébergées en Union Européenne
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
