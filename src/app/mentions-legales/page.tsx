import Link from 'next/link';
import { BotOrb } from '@/components/widget/parts';

export const metadata = {
  title: 'Mentions Légales — Luminae',
  description: 'Mentions légales, éditeur et hébergement de la plateforme Luminae.'
};

export default function LegalNoticePage() {
  return (
    <main className="min-h-screen aurora-dark-bg text-white selection:bg-aurora-500/30 selection:text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur-xl bg-ink-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="flex items-center gap-2 sm:gap-3">
            <BotOrb size={28} glow />
            <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-white">Luminae</span>
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10"
          >
            &larr; Retour à l&apos;accueil
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-aurora-500/30 bg-aurora-500/10 px-3.5 py-1 text-xs font-medium text-aurora-300 mb-6">
          <span>📜</span>
          <span>Informations Légales & Éditeur</span>
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Mentions Légales
        </h1>
        <p className="mt-3 text-sm text-mist-300">
          Conformément aux dispositions de l&apos;article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique (LCEN).
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-mist-200">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h2 className="text-base font-bold text-white mb-2">1. Éditeur de la Plateforme</h2>
            <p>
              Le site et la plateforme <strong>Luminae</strong> (accessible à l&apos;adresse <code>https://luminae.vercel.app</code>) sont édités par l&apos;équipe de développement Luminae.
            </p>
            <ul className="mt-3 space-y-1 text-mist-300">
              <li><strong>Contact :</strong> <a href="mailto:contact@luminae.app" className="text-aurora-300 underline underline-offset-2">contact@luminae.app</a></li>
              <li><strong>Directeur de la publication :</strong> Direction Générale Luminae</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h2 className="text-base font-bold text-white mb-2">2. Hébergement de l&apos;Application</h2>
            <p>L&apos;infrastructure web et les services de base de données de Luminae sont hébergés par :</p>
            <ul className="mt-3 space-y-2 text-mist-300">
              <li>
                <strong>Hébergement Frontend & Edge :</strong><br />
                Vercel Inc. — 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.<br />
                <span className="text-xs text-mist-400">Réseau Edge CDN avec points de présence à Paris et Francfort.</span>
              </li>
              <li>
                <strong>Base de Données & Stockage (Région UE) :</strong><br />
                Supabase Inc. — Hébergement européen sécurisé (Région EU-Central / EU-West).
              </li>
              <li>
                <strong>Moteur d&apos;Intelligence Artificielle Souverain :</strong><br />
                Mistral AI SAS — 15 rue des Halles, 75001 Paris, France.<br />
                <span className="text-xs text-mist-400">Modèles hébergés et exécutés exclusivement en France et en Union Européenne.</span>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h2 className="text-base font-bold text-white mb-2">3. Propriété Intellectuelle</h2>
            <p>
              L&apos;ensemble des éléments graphiques, marques, logos, visuels, algorithmes et codes sources constituant la plateforme Luminae sont protégés par le droit de la propriété intellectuelle et demeurent la propriété exclusive de leurs auteurs respectifs.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h2 className="text-base font-bold text-white mb-2">4. Sécurité & Disponibilité</h2>
            <p>
              Luminae met en œuvre tous les moyens raisonnables pour assurer un accès continu et sécurisé au service. Des sauvegardes régulières et des chiffrements en transit (HTTPS / TLS 1.3) protègent l&apos;intégrité des flux de communication.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
