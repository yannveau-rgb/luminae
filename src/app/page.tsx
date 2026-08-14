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
    title: 'IA RAG 100% Made in France',
    badge: 'Mistral AI (Paris)',
    description:
      'Propulsé par les modèles souverains de Mistral AI hébergés en France/UE. Réponses instantanées et précises issues de votre base de connaissances sans hallucination.'
  },
  {
    icon: (
      <svg className="h-6 w-6 text-sun-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Conformité RGPD & CNIL Native',
    badge: 'Droit à l’oubli supervisé',
    description:
      'Zéro transfert hors UE, aucun cookie traceur tiers. Vos visiteurs exercent leur droit à l’effacement en 1 clic directement dans le widget avec purge immédiate.'
  },
  {
    icon: (
      <svg className="h-6 w-6 text-lagoon-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: 'Escalade & Boîte Agent Pro',
    badge: 'Temps réel WebSocket',
    description:
      'Basculement automatique vers vos conseillers dès que nécessaire. Inbox unifiée avec suivi de navigation en direct et Copilot d’aide à la rédaction.'
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
    <main className="min-h-screen aurora-dark-bg text-white selection:bg-aurora-500/30 selection:text-white overflow-x-hidden">
      {/* ── Navigation ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur-xl bg-ink-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="flex items-center gap-2 sm:gap-3">
            <BotOrb size={28} glow />
            <div className="flex items-baseline gap-2">
              <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-white">Luminae</span>
              <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-wider text-aurora-400">
                Support Souverain
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/widget"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-medium text-white transition hover:bg-white/10 hover:border-white/25"
            >
              Tester le Widget
            </Link>
            <Link
              href="/login"
              className="rounded-xl bg-lagoon-600 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-white shadow-glow-sm transition hover:bg-lagoon-500"
            >
              Espace Agent &rarr;
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero Principal ────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-5xl px-4 pb-16 pt-12 text-center sm:px-6 sm:pb-20 sm:pt-16 lg:pt-20">
        {/* Badge animé */}
        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-aurora-500/30 bg-aurora-500/10 px-3.5 py-1.5 text-[11px] sm:text-xs font-medium text-aurora-300 shadow-glow-sm">
          <span className="text-sm shrink-0">🇫🇷</span>
          <span className="truncate">Chat IA 100% Made in France · Souveraineté & RGPD</span>
        </div>

        {/* Titre percutant */}
        <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-tight">
          Le support client IA souverain,
          <br />
          <span className="bg-gradient-to-r from-aurora-300 via-lagoon-300 to-white bg-clip-text text-transparent">
            conforme RGPD & Made in France.
          </span>
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-mist-300 sm:mt-6 sm:text-base md:text-lg">
          Un assistant conversationnel fluide propulsé par <strong>Mistral AI (Paris)</strong>, couplé à une boîte de
          réception agent haute performance et un droit à l’oubli supervisé. L’alternative européenne éthique à Intercom et Zendesk.
        </p>

        {/* Boutons d'action */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Link
            href="/widget"
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-lagoon-600 px-6 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:bg-lagoon-500"
          >
            <BotOrb size={20} glow={false} />
            <span>Tester le Widget en Direct</span>
          </Link>
          <Link
            href="/login"
            className="flex w-full sm:w-auto items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10 hover:border-white/30"
          >
            <span>Accéder à la Boîte Agent</span>
          </Link>
        </div>

        {/* ── Mockup Démonstrateur Interactif Responsive ─────────────────────────────────── */}
        <div className="relative mx-auto mt-10 max-w-4xl rounded-2xl border border-white/15 bg-ink-900/90 p-4 sm:p-5 shadow-card-dark backdrop-blur-2xl text-left">
          {/* Barre de fenêtre */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3 sm:pb-4">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-coral-500/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-sun-500/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-lagoon-500/80" />
              <span className="ml-1 text-[11px] sm:text-xs font-mono text-mist-400">luminae-preview</span>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1 text-xs overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveStep('rag')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition shrink-0 ${
                  activeStep === 'rag' ? 'bg-aurora-500/20 text-aurora-300 font-bold' : 'text-mist-400 hover:text-white'
                }`}
              >
                1. RAG Bot
              </button>
              <button
                type="button"
                onClick={() => setActiveStep('human')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition shrink-0 ${
                  activeStep === 'human' ? 'bg-lagoon-500/20 text-lagoon-300 font-bold' : 'text-mist-400 hover:text-white'
                }`}
              >
                2. Escalade
              </button>
              <button
                type="button"
                onClick={() => setActiveStep('copilot')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition shrink-0 ${
                  activeStep === 'copilot' ? 'bg-sun-500/20 text-sun-300 font-bold' : 'text-mist-400 hover:text-white'
                }`}
              >
                3. Copilot
              </button>
            </div>
          </div>

          {/* Corps de la démo */}
          <div className="mt-4 space-y-3">
            {activeStep === 'rag' && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex justify-end">
                  <div className="max-w-md rounded-2xl rounded-br-sm bg-lagoon-600 px-3.5 py-2 text-xs text-white leading-relaxed">
                    Bonjour, comment réinitialiser mon mot de passe et quelles sont vos garanties de sécurité RGPD ?
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <div className="mt-0.5 shrink-0">
                    <BotOrb size={26} glow />
                  </div>
                  <div className="max-w-lg rounded-2xl rounded-bl-sm border border-aurora-400/40 bg-white/10 p-3 text-xs text-mist-100 backdrop-blur-md leading-relaxed">
                    <p className="font-semibold text-aurora-300 mb-1">⚡ Réponse Lumi (Assistant IA) :</p>
                    <p>
                      Pour réinitialiser votre mot de passe, cliquez sur <em>« Mot de passe oublié »</em> sur la page de connexion.
                      Vos données sont traitées exclusivement en France/UE avec conformité RGPD stricte.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px] text-aurora-400">
                      <span className="rounded-full bg-aurora-500/20 px-2 py-0.5 font-medium">Source : Guide Sécurité</span>
                      <span>· Confiance : 98%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeStep === 'human' && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex justify-center">
                  <span className="rounded-full border border-lagoon-400/30 bg-lagoon-500/10 px-3 py-1 text-[10.5px] font-medium text-lagoon-300 text-center">
                    ⚡ Escalade déclenchée · Yann a rejoint la conversation
                  </span>
                </div>
                <div className="flex gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lagoon-600 text-xs font-bold text-white">
                    YV
                  </div>
                  <div className="max-w-md rounded-2xl rounded-bl-sm border border-white/10 bg-white/5 p-3 text-xs text-mist-100 leading-relaxed">
                    Bonjour ! Je prends le relais. J&apos;ai sous les yeux votre page consultée et l&apos;historique complet de votre échange. Comment puis-je vous aider ?
                  </div>
                </div>
              </div>
            )}

            {activeStep === 'copilot' && (
              <div className="space-y-3 animate-fade-in">
                <div className="rounded-xl border border-sun-500/30 bg-sun-500/10 p-3 text-xs text-sun-100">
                  <div className="flex items-center gap-1.5 font-bold text-sun-300">
                    <span>✨ Suggestion Copilot IA :</span>
                  </div>
                  <p className="mt-1 leading-relaxed">
                    « Vos attestations sont disponibles au téléchargement sur votre espace personnel sécurisé pendant 12 mois. »
                  </p>
                  <button
                    type="button"
                    className="mt-2 rounded-lg bg-sun-500/20 px-3 py-1 text-[11px] font-semibold text-sun-300 hover:bg-sun-500/30 transition"
                  >
                    Insérer dans la réponse (1-clic)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Grille des 3 Piliers ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 border-t border-white/10">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl md:text-3xl">
            L&apos;alternative éthique et souveraine aux plateformes américaines
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-mist-300">
            Conçu pour les entreprises exigeantes soucieuses de la confidentialité de leurs échanges.
          </p>
        </div>

        <div className="grid gap-5 sm:gap-6 md:grid-cols-3">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="glass-dark group relative rounded-2xl p-5 sm:p-6 transition duration-200 hover:-translate-y-1 hover:border-aurora-500/40"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-white/5 border border-white/10 group-hover:border-aurora-500/30 transition">
                  {p.icon}
                </div>
                <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10.5px] font-semibold text-aurora-300 border border-white/10">
                  {p.badge}
                </span>
              </div>
              <h3 className="mt-4 font-display text-sm sm:text-base font-bold text-white">{p.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-mist-300">{p.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Intégration en 1 ligne ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6 sm:pb-24 text-center">
        <div className="rounded-2xl sm:rounded-3xl border border-white/15 bg-gradient-to-b from-white/10 to-white/5 p-5 sm:p-8 shadow-card-dark backdrop-blur-xl">
          <h2 className="font-display text-lg font-bold text-white sm:text-xl md:text-2xl">
            Intégrable sur n&apos;importe quel site en une seule ligne
          </h2>
          <p className="mt-1.5 text-xs text-mist-300">
            Insérez ce script avant la fermeture de votre balise <code className="text-aurora-300">&lt;/body&gt;</code>.
          </p>

          <div className="relative mx-auto mt-5 max-w-xl text-left">
            <div className="flex items-center justify-between rounded-t-xl border border-b-0 border-white/10 bg-ink-950/80 px-3.5 py-2">
              <span className="text-[11px] font-mono text-mist-400">HTML Snippet</span>
              <button
                type="button"
                onClick={copyCode}
                className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                {copied ? '✓ Copié !' : 'Copier'}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-b-xl border border-white/10 bg-ink-950 p-3.5 sm:p-4 font-mono text-[11px] sm:text-xs text-aurora-300 shadow-inner break-all whitespace-pre-wrap sm:whitespace-pre">
              {EMBED_SNIPPET}
            </pre>
          </div>
        </div>
      </section>

      {/* ── Pied de page Souveraineté ────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-8 px-4 text-center text-xs text-mist-400">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
          <span className="rounded-md bg-white/5 px-2 py-1 text-[11px]">🇫🇷 100% Made in France</span>
          <span className="rounded-md bg-white/5 px-2 py-1 text-[11px]">🔒 Hébergement Souverain UE</span>
          <span className="rounded-md bg-white/5 px-2 py-1 text-[11px]">⚖️ Conforme RGPD & CNIL</span>
          <span className="rounded-md bg-white/5 px-2 py-1 text-[11px]">✨ Propulsé par Mistral AI</span>
        </div>
        <p className="mt-3 text-[11px] text-mist-400">
          Luminae 2.0 · Plateforme de messagerie client souveraine et intelligence artificielle de pointe.
        </p>
      </footer>
    </main>
  );
}
