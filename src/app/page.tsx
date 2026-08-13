import Link from 'next/link';
import { BotOrb } from '@/components/widget/parts';

const EMBED_SNIPPET = `<script src="https://luminae.app/embed.js"
        data-luminae-src="https://luminae.app"></script>`;

const FEATURES = [
  {
    title: 'Bot RAG entraîné sur votre base',
    body: 'Réponses sourcées depuis vos articles de connaissance, avec embeddings Mistral et boost par contexte appareil.'
  },
  {
    title: 'Escalade humaine fluide',
    body: 'Détection d’intention, heures ouvrées, file d’attente et reprise par un agent sans friction.'
  },
  {
    title: 'Boîte de réception agent',
    body: 'Temps réel, notes internes, résumés automatiques, suggestions Copilot et réponses types.'
  },
  {
    title: 'Conformité & sobriété',
    body: 'Données hébergées en UE (Supabase), chiffrement, pas de tracking tiers, interface allégée.'
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-mist-50 to-mist">
      {/* En-tête */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <BotOrb size={30} glow={false} />
          <span className="font-display text-lg font-semibold tracking-tight">Luminae</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            href="/widget"
            className="rounded-full border border-lagoon-200 bg-white px-4 py-2 text-sm font-medium text-lagoon-700 transition hover:bg-lagoon-50"
          >
            Voir le widget
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink-700"
          >
            Espace agent
          </Link>
        </nav>
      </header>

      {/* Héros */}
      <section className="mx-auto max-w-3xl px-6 pb-16 pt-14 text-center">
        <p className="mx-auto mb-5 inline-block rounded-full border border-lagoon-200 bg-lagoon-50 px-3 py-1 text-xs font-medium text-lagoon-700">
          Plateforme Luminae · V1
        </p>
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Le support client qui répond
          <br />
          <span className="text-lagoon-600">avant que l’attente ne pèse.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-500">
          Un bot entraîné sur votre base de connaissance, une escalade humaine instantanée et une boîte de réception
          pensée pour les agents. Installable sur votre site en une ligne de script.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/widget"
            className="rounded-full bg-lagoon-600 px-6 py-3 text-sm font-semibold text-white shadow-glow-sm transition hover:bg-lagoon-700"
          >
            Essayer le widget de démo
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-mist-300 bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:border-lagoon-300"
          >
            Se connecter
          </Link>
        </div>

        {/* Bloc d'intégration */}
        <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-mist-300 bg-ink p-4 text-left shadow-glow">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-aurora">
            Intégration sur votre site
          </p>
          <code className="block overflow-x-auto whitespace-pre text-[12.5px] leading-relaxed text-mist-100">
            {EMBED_SNIPPET}
          </code>
        </div>
      </section>

      {/* Fonctionnalités */}
      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-20 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <article
            key={f.title}
            className="rounded-2xl border border-mist-300 bg-white p-6 shadow-bubble transition hover:shadow-glow-sm"
          >
            <h2 className="font-display text-base font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">{f.body}</p>
          </article>
        ))}
      </section>

      <footer className="border-t border-mist-300 bg-white/60 py-6 text-center text-xs text-ink-400">
        Luminae · Données hébergées en Union Européenne
      </footer>
    </main>
  );
}
