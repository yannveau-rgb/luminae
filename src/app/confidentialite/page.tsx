import Link from 'next/link';
import { BotOrb } from '@/components/widget/parts';

export const metadata = {
  title: 'Politique de Confidentialité & RGPD — Luminae',
  description: 'Engagement de confidentialité, conformité RGPD et politique de protection des données personnelles de Luminae.'
};

export default function PrivacyPage() {
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
          <span>⚖️</span>
          <span>Protection des Données & Conformité RGPD</span>
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Politique de Confidentialité & Protection des Données
        </h1>
        <p className="mt-3 text-sm text-mist-300">
          Dernière mise à jour : 17 août 2026 · Conforme au Règlement Général sur la Protection des Données (RGPD) n° 2016/679 et à la loi Informatique et Libertés.
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-mist-200">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h2 className="text-base font-bold text-white mb-2">1. Principes Fondamentaux & Souveraineté Européenne</h2>
            <p>
              Luminae a été conçue selon le principe de <strong>Privacy by Design</strong> (protection des données dès la conception). L&apos;ensemble de nos traitements est opéré exclusivement sur des serveurs hébergés au sein de l&apos;Union Européenne (France et Allemagne), garantissant une étanchéité totale face aux législations extraterritoriales (telles que le Cloud Act américain).
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h2 className="text-base font-bold text-white mb-2">2. Données Traitées & Finalités</h2>
            <p>Dans le cadre du fonctionnement du chat et de la boîte de réception :</p>
            <ul className="mt-2 list-disc list-inside space-y-1.5 text-mist-300">
              <li><strong>Contenu des messages :</strong> Traités afin de fournir une réponse automatique instantanée via l&apos;IA ou de permettre la prise en charge par un conseiller humain.</li>
              <li><strong>Informations techniques de session :</strong> Type d&apos;appareil (mobile/desktop), navigateur, et page web consultée, afin de permettre au conseiller de contextualiser l&apos;assistance.</li>
              <li><strong>Coordonnées volontaires :</strong> Prénom, adresse e-mail ou numéro de téléphone uniquement lorsque le visiteur choisit librement de les renseigner pour être recontacté.</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h2 className="text-base font-bold text-white mb-2">3. Traitement par Intelligence Artificielle (Mistral AI)</h2>
            <p>
              L&apos;assistant conversationnel utilise les modèles souverains de la société française <strong>Mistral AI</strong> (Paris). Les requêtes sont traitées dans des centres de données situés en Union Européenne. Vos échanges et données d&apos;entreprise ne sont <strong>jamais utilisés pour ré-entraîner des modèles publics</strong> tiers.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h2 className="text-base font-bold text-white mb-2">4. Durée de Conservation & Purge Automatique</h2>
            <p>
              Les conversations résolues sont conservées pendant une durée maximale de <strong>12 mois</strong> à des fins de suivi de la qualité de service, après quoi elles sont automatiquement et définitivement purgées de la base de données.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h2 className="text-base font-bold text-white mb-2">5. Droit à l&apos;Oubli & Suppression Immédiate</h2>
            <p>
              Conformément à l&apos;article 17 du RGPD, chaque visiteur dispose du droit d&apos;obtenir l&apos;effacement immédiat de ses données personnelles. Ce droit s&apos;exerce directement en 1 clic via le bouton <em>« Supprimer mes données »</em> présent dans le pied du widget conversationnel, ou en adressant un e-mail à l&apos;équipe support.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h2 className="text-base font-bold text-white mb-2">6. Cookies & Traceurs</h2>
            <p>
              Luminae <strong>n&apos;utilise aucun cookie tiers publicitaire ni traceur commercial</strong>. Seuls les identifiants techniques strictement nécessaires à la continuité de la session de chat (stockage local du token de conversation) sont utilisés, exemptés de consentement préalable conformément aux recommandations de la CNIL.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h2 className="text-base font-bold text-white mb-2">7. Contact & Délégué à la Protection des Données (DPO)</h2>
            <p>
              Pour toute question relative à vos données personnelles ou pour exercer vos droits (accès, rectification, portabilité), vous pouvez contacter notre équipe à : <a href="mailto:privacy@luminae.app" className="text-aurora-300 underline underline-offset-2">privacy@luminae.app</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
