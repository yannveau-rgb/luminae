/** Types et modèles pour le moteur de workflows intelligents Luminae. */

export type WorkflowTriggerType =
  | 'message_received'
  | 'conversation_created'
  | 'intent_detected'
  | 'after_hours'
  | 'conversation_escalated';

export type WorkflowActionType =
  | 'send_message'
  | 'add_tag'
  | 'assign_agent'
  | 'add_internal_note'
  | 'suggest_call';

export interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: WorkflowTriggerType;
  trigger_value?: string; // ex: 'results_grades', 'pricing_subscription'
  conditions: {
    keywords?: string[]; // mots-clés dans le message
    url_contains?: string; // URL de la page
    is_offline?: boolean; // Hors horaires
  };
  actions: {
    type: WorkflowActionType;
    payload?: string; // Texte du message, nom du tag, ID agent, texte de note
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
        payload: 'Bonjour ! Je vois que vous vous intéressez à nos offres. Souhaitez-vous qu’un conseiller commercial vous présente une démo sur-mesure ou vous prépare un devis ?'
      },
      {
        type: 'add_tag',
        payload: 'Lead Commercial'
      }
    ],
    execution_count: 24,
    last_executed_at: new Date(Date.now() - 3600000).toISOString()
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
    execution_count: 8,
    last_executed_at: new Date(Date.now() - 14400000).toISOString()
  },
  {
    id: 'wf_order_tracking',
    name: '📦 Auto-Réponse Suivi de Commande & Livraison',
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
    execution_count: 53,
    last_executed_at: new Date(Date.now() - 1800000).toISOString()
  },
  {
    id: 'wf_after_hours_call',
    name: '🌙 Accueil & Rappel Hors Horaires',
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
    execution_count: 19,
    last_executed_at: new Date(Date.now() - 86400000).toISOString()
  }
];
