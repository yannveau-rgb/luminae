/** Classification et analyse des intentions de contact des visiteurs (causes de contact). */

export interface ContactIntent {
  id: string;
  label: string;
  category: string;
  icon: string;
  colorClass: string;
  badgeClass: string;
}

export const INTENT_DEFINITIONS: Record<string, ContactIntent> = {
  orders_shipping: {
    id: 'orders_shipping',
    label: 'Commandes, Livraison & Colis',
    category: 'E-commerce & Livraison',
    icon: '📦',
    colorClass: 'bg-aurora-500',
    badgeClass: 'bg-aurora-500/15 text-aurora-600 border-aurora-300/40'
  },
  pricing_subscription: {
    id: 'pricing_subscription',
    label: 'Tarifs, Forfaits & Devis',
    category: 'Commercial & Vente',
    icon: '🎯',
    colorClass: 'bg-lagoon-600',
    badgeClass: 'bg-lagoon-50 text-lagoon-700 border-lagoon-200'
  },
  tech_support_access: {
    id: 'tech_support_access',
    label: 'Support Technique & Connexion',
    category: 'Assistance Technique',
    icon: '🔧',
    colorClass: 'bg-sun-500',
    badgeClass: 'bg-sun-50 text-sun-700 border-sun-300'
  },
  delays_tracking: {
    id: 'delays_tracking',
    label: 'Délais de Traitement & Suivi',
    category: 'Suivi & Délais',
    icon: '⏱️',
    colorClass: 'bg-coral-500',
    badgeClass: 'bg-coral-50 text-coral-600 border-coral-300'
  },
  security_gdpr: {
    id: 'security_gdpr',
    label: 'Sécurité, Données & RGPD',
    category: 'Conformité & RGPD',
    icon: '🔒',
    colorClass: 'bg-ink-700',
    badgeClass: 'bg-mist-100 text-ink-700 border-mist-300'
  },
  general_inquiry: {
    id: 'general_inquiry',
    label: 'Informations Générales & Découverte',
    category: 'Général',
    icon: '💬',
    colorClass: 'bg-mist-400',
    badgeClass: 'bg-mist-100 text-ink-600 border-mist-300'
  }
};

const KEYWORD_RULES: { intentId: string; keywords: string[] }[] = [
  {
    intentId: 'orders_shipping',
    keywords: ['commande', 'commandes', 'colis', 'livraison', 'livrer', 'suivi', 'expedition', 'expedie', 'chronopost', 'colissimo', 'dhl', 'transporteur', 'reception', 'recu', 'tracking']
  },
  {
    intentId: 'pricing_subscription',
    keywords: ['tarif', 'tarifs', 'prix', 'cout', 'combien', 'forfait', 'abonnement', 'payer', 'paiement', 'devis', 'facture', 'facturation', 'offre', 'reduction', 'code promo']
  },
  {
    intentId: 'tech_support_access',
    keywords: ['connexion', 'connecter', 'mot de passe', 'mdp', 'password', 'login', 'acces', 'bloque', 'erreur', 'bug', 'marche pas', 'fonctionne pas', 'impossible de', 'reset', 'reinitialiser', 'compte']
  },
  {
    intentId: 'delays_tracking',
    keywords: ['quand', 'quel jour', 'date', 'delai', 'delais', 'temps', 'attendre', 'attente', 'combien de temps', 'retard', 'ouvre', 'jours ouvres', 'reception', 'recu', 'recue', 'statut']
  },
  {
    intentId: 'security_gdpr',
    keywords: ['rgpd', 'cnil', 'donnees', 'donnee', 'supprimer', 'effacer', 'confidentialite', 'vie privee', 'chiffrement', 'securite', 'droit a l', 'oubli', 'purge']
  }
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
}

/**
 * Détermine l'intention de contact principale à partir du contenu des messages ou de l'URL source.
 */
export function classifyConversationIntent(firstMessageText?: string | null, sourceUrl?: string | null): ContactIntent {
  const normMsg = normalizeText(firstMessageText ?? '');
  const normUrl = normalizeText(sourceUrl ?? '');

  if (normUrl.includes('tarif') || normUrl.includes('pricing')) {
    return INTENT_DEFINITIONS.pricing_subscription;
  }
  if (normUrl.includes('rgpd') || normUrl.includes('privacy') || normUrl.includes('confidentialite')) {
    return INTENT_DEFINITIONS.security_gdpr;
  }

  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      const kwNorm = normalizeText(kw);
      const regex = new RegExp(`\\b${kwNorm}\\b`, 'i');
      if (regex.test(normMsg)) {
        return INTENT_DEFINITIONS[rule.intentId] ?? INTENT_DEFINITIONS.general_inquiry;
      }
    }
  }

  // Repli sur sous-chaîne si pas de correspondance de mot entier
  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (kw.length >= 4 && normMsg.includes(normalizeText(kw))) {
        return INTENT_DEFINITIONS[rule.intentId] ?? INTENT_DEFINITIONS.general_inquiry;
      }
    }
  }

  return INTENT_DEFINITIONS.general_inquiry;
}
