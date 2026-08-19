/** Types et modèles pour le moteur de workflows intelligents et automatisations Luminae. */

export type WorkflowTriggerType =
  | 'message_received'
  | 'conversation_created'
  | 'intent_detected'
  | 'after_hours'
  | 'conversation_escalated'
  | 'page_visited'
  | 'cart_abandoned';

export type WorkflowActionType =
  | 'send_message'
  | 'add_tag'
  | 'assign_agent'
  | 'add_internal_note'
  | 'suggest_call'
  | 'send_webhook';

export interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: WorkflowTriggerType;
  trigger_value?: string; // ex: 'orders_shipping', 'pricing_subscription', 'refunds_returns', '/panier'
  conditions: {
    keywords?: string[]; // mots-clés dans le message
    url_contains?: string; // URL de la page
    is_offline?: boolean; // Hors horaires
  };
  actions: {
    type: WorkflowActionType;
    payload?: string; // Texte du message, nom du tag, ID agent, texte de note, URL webhook
  }[];
  execution_count: number;
  last_executed_at?: string | null;
}

export const WORKFLOW_TEMPLATES: WorkflowRule[] = [
  {
    id: 'wf_leads_pricing',
    name: '🚀 Qualification Commerciale & Devis',
    description: 'Détecte les demandes de tarifs ou forfaits, tag la conversation en lead chaud et envoie une proposition de démo.',
    enabled: true,
    trigger: 'intent_detected',
    trigger_value: 'pricing_subscription',
    conditions: {
      keywords: ['tarif', 'prix', 'devis', 'combien', 'forfait', 'abonnement', 'offre'],
      url_contains: 'tarif'
    },
    actions: [
      {
        type: 'send_message',
        payload: 'Bonjour ! Je vois que vous vous intéressez à nos offres. Souhaitez-vous qu’un conseiller commercial vous présente une démo sur-mesure ou vous prépare un devis personnalisé ?'
      },
      {
        type: 'add_tag',
        payload: 'Lead Commercial'
      }
    ],
    execution_count: 38,
    last_executed_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'wf_cart_checkout',
    name: '🛒 Assistance Panier & Conversion Vente',
    description: 'Surveille la présence sur le panier ou la page de commande pour proposer de l’aide en direct et éviter les abandons.',
    enabled: true,
    trigger: 'page_visited',
    trigger_value: 'panier',
    conditions: {
      url_contains: 'panier'
    },
    actions: [
      {
        type: 'add_tag',
        payload: 'Panier Chaud'
      },
      {
        type: 'add_internal_note',
        payload: '🛒 Visiteur actuellement sur le tunnel de commande / panier.'
      },
      {
        type: 'send_message',
        payload: 'Bonjour ! Une question sur la livraison ou un moyen de paiement pour finaliser votre commande ? Je suis là pour vous aider.'
      }
    ],
    execution_count: 62,
    last_executed_at: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: 'wf_urgent_vip',
    name: '🚨 Détection Urgence & Priorité VIP',
    description: 'Détecte les signaux de blocage ou d’urgence pour taguer la discussion en haute priorité et alerter l’équipe.',
    enabled: true,
    trigger: 'message_received',
    conditions: {
      keywords: ['urgent', 'bloque', 'bloquée', 'critique', 'panne', 'inadmissible', 'probleme grave']
    },
    actions: [
      {
        type: 'add_tag',
        payload: 'Priorité Haute'
      },
      {
        type: 'add_internal_note',
        payload: '⚠️ Signalement urgent détecté dans le message du visiteur. Prise en charge prioritaire requise.'
      },
      {
        type: 'send_message',
        payload: 'Votre demande a été marquée comme prioritaire. Notre équipe d’assistance intervient dans les plus brefs délais.'
      }
    ],
    execution_count: 14,
    last_executed_at: new Date(Date.now() - 14400000).toISOString()
  },
  {
    id: 'wf_order_tracking',
    name: '📦 Auto-Réponse Suivi de Commande & Expédition',
    description: 'Répond immédiatement aux questions sur les commandes et expéditions avec les délais moyens (48h à 72h ouvrées).',
    enabled: true,
    trigger: 'intent_detected',
    trigger_value: 'orders_shipping',
    conditions: {
      keywords: ['commande', 'colis', 'livraison', 'suivi', 'expedition', 'transporteur']
    },
    actions: [
      {
        type: 'send_message',
        payload: 'Pour suivre votre commande, indiquez votre numéro de colis (#1234) ou votre adresse e-mail. Les commandes sont généralement expédiées sous 24h et livrées sous 48h à 72h ouvrées.'
      }
    ],
    execution_count: 91,
    last_executed_at: new Date(Date.now() - 1800000).toISOString()
  },
  {
    id: 'wf_refund_returns',
    name: '↩️ Rétractation, Échange & Retours Produits',
    description: 'Guide le client sur la procédure de retour sous 14 jours et applique le tag SAV.',
    enabled: true,
    trigger: 'intent_detected',
    trigger_value: 'refunds_returns',
    conditions: {
      keywords: ['retour', 'rembourser', 'remboursement', 'retractation', 'renvoyer', 'echange']
    },
    actions: [
      {
        type: 'add_tag',
        payload: 'Demande SAV / Retours'
      },
      {
        type: 'send_message',
        payload: 'Vous disposez de 14 jours après réception pour retourner un article. Assurez-vous que le produit est dans son état d’origine avec ses étiquettes pour un remboursement sous 5 jours ouvrés.'
      }
    ],
    execution_count: 27,
    last_executed_at: new Date(Date.now() - 25200000).toISOString()
  },
  {
    id: 'wf_after_hours_call',
    name: '🌙 Accueil & Rappel Téléphonique Hors Horaires',
    description: 'Informe le visiteur en dehors des heures d’ouverture et propose de programmer un rappel téléphonique.',
    enabled: true,
    trigger: 'after_hours',
    conditions: {
      is_offline: true
    },
    actions: [
      {
        type: 'send_message',
        payload: 'Nos conseillers sont actuellement indisponibles. Vous pouvez nous laisser votre numéro de téléphone pour être rappelé dès la réouverture.'
      },
      {
        type: 'suggest_call',
        payload: 'Demander un rappel'
      }
    ],
    execution_count: 31,
    last_executed_at: new Date(Date.now() - 86400000).toISOString()
  }
];
