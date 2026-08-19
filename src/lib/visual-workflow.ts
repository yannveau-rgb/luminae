/**
 * Modèle et Types pour le Studio de Workflows Visuels No-Code Luminae (Flow Canvas).
 * Standard mondial (Intercom Visual Bots / Voiceflow / Botpress).
 */

export type FlowNodeType =
  | 'trigger'      // Déclencheur (Intention IA, Mot-clé, URL, Événement)
  | 'message'      // Envoi d'un message du bot
  | 'buttons'      // Question avec boutons de choix visiteur (bifurcation A/B/C)
  | 'condition'    // Évaluation de condition (Horaires ouverts vs fermés, Appareil, etc.)
  | 'action'       // Action métier (Taguer, Assigner agent, Note interne, Appel, Webhook)
  | 'end';         // Clôture ou fin de branche

export interface ChoiceOption {
  id: string;
  label: string;
  targetNodeId?: string | null;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  title: string;
  position: { x: number; y: number };
  data: {
    // Déclencheur
    triggerType?: 'intent_detected' | 'message_received' | 'page_visited' | 'after_hours';
    triggerValue?: string; // ex: 'tech_support', 'pricing', '/panier'
    keywords?: string[];
    // Message
    message?: string;
    // Choix visiteur
    question?: string;
    options?: ChoiceOption[];
    // Condition
    conditionType?: 'business_hours' | 'device' | 'cart_amount' | 'page_url';
    conditionValue?: string;
    // Action
    actionType?: 'add_tag' | 'assign_agent' | 'add_internal_note' | 'suggest_call' | 'send_webhook' | 'resolve_conversation';
    actionPayload?: string;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  sourceHandle?: string; // ex: 'opt_0', 'opt_1', 'true', 'false', 'default'
  target: string;
}

export interface VisualWorkflow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
  execution_count: number;
  last_executed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** ── TEMPLATES VISUELS PRÊTS À L'EMPLOI ────────────────────────────────────── */

export const VISUAL_WORKFLOW_TEMPLATES: VisualWorkflow[] = [
  {
    id: 'vwf_tech_support',
    name: '🔧 Diagnostic & Résolution Technique (Notifications / Connexion)',
    description: 'Guide pas-à-pas le visiteur pour réparer ses notifications selon son navigateur, évalue la satisfaction puis assigne si non résolu.',
    enabled: true,
    execution_count: 142,
    last_executed_at: new Date(Date.now() - 1800000).toISOString(),
    nodes: [
      {
        id: 'node_trigger',
        type: 'trigger',
        title: '⚡ Évaluer l’intention',
        position: { x: 420, y: 40 },
        data: {
          triggerType: 'intent_detected',
          triggerValue: 'tech_support_access',
          keywords: ['notification', 'notif', 'alerte', 'bloque', 'navigateur', 'autoriser']
        }
      },
      {
        id: 'node_ask_browser',
        type: 'buttons',
        title: '🌐 Quel navigateur utilisez-vous ?',
        position: { x: 380, y: 160 },
        data: {
          question: 'Pour vous donner la manipulation exacte, quel navigateur web utilisez-vous actuellement ?',
          options: [
            { id: 'opt_chrome', label: 'Google Chrome', targetNodeId: 'node_help_chrome' },
            { id: 'opt_edge', label: 'Microsoft Edge', targetNodeId: 'node_help_edge' },
            { id: 'opt_firefox', label: 'Mozilla Firefox', targetNodeId: 'node_help_firefox' },
            { id: 'opt_safari', label: 'Apple Safari', targetNodeId: 'node_help_safari' }
          ]
        }
      },
      {
        id: 'node_help_chrome',
        type: 'message',
        title: '💡 Guide Chrome',
        position: { x: 50, y: 340 },
        data: {
          message: 'Sur Google Chrome :\n1. Cliquez sur l’icône 🔒 à gauche de la barre d’adresse.\n2. Activez l’interrupteur « Notifications » sur Autoriser.\n3. Rechargez la page (F5).'
        }
      },
      {
        id: 'node_help_edge',
        type: 'message',
        title: '💡 Guide Edge',
        position: { x: 300, y: 340 },
        data: {
          message: 'Sur Microsoft Edge :\n1. Cliquez sur le cadenas 🔒 à gauche de l’URL.\n2. Allez dans Autorisations pour ce site > Notifications > Définir sur Autoriser.\n3. Actualisez la page.'
        }
      },
      {
        id: 'node_help_firefox',
        type: 'message',
        title: '💡 Guide Firefox',
        position: { x: 550, y: 340 },
        data: {
          message: 'Sur Mozilla Firefox :\n1. Cliquez sur le cadenas 🔒 > Supprimez le blocage des notifications dans Paramètres de sécurité.\n2. Réactualisez votre session.'
        }
      },
      {
        id: 'node_help_safari',
        type: 'message',
        title: '💡 Guide Safari',
        position: { x: 800, y: 340 },
        data: {
          message: 'Sur Safari (Mac/iOS) :\n1. Safari > Réglages > Sites web > Notifications.\n2. Cherchez ce site et sélectionnez « Autoriser ».'
        }
      },
      {
        id: 'node_satisfaction',
        type: 'buttons',
        title: '❓ Ai-je répondu à votre demande ?',
        position: { x: 420, y: 520 },
        data: {
          question: 'Est-ce que vos notifications fonctionnent correctement maintenant ?',
          options: [
            { id: 'opt_yes', label: '✅ Oui, problème résolu !', targetNodeId: 'node_resolved_msg' },
            { id: 'opt_no', label: '❌ Non, j’ai encore besoin d’aide', targetNodeId: 'node_check_hours' }
          ]
        }
      },
      {
        id: 'node_resolved_msg',
        type: 'message',
        title: '🎉 Clôture & Remerciement',
        position: { x: 220, y: 700 },
        data: {
          message: 'Parfait, ravi d’avoir pu vous aider ! Je vous souhaite une excellente journée.'
        }
      },
      {
        id: 'node_check_hours',
        type: 'condition',
        title: '⏰ Équipe disponible ?',
        position: { x: 620, y: 700 },
        data: {
          conditionType: 'business_hours'
        }
      },
      {
        id: 'node_assign_agent',
        type: 'action',
        title: '🧑‍💻 Escalade Conseiller Humain',
        position: { x: 500, y: 860 },
        data: {
          actionType: 'add_tag',
          actionPayload: 'Support Technique Urgent'
        }
      },
      {
        id: 'node_offline_msg',
        type: 'message',
        title: '🌙 Message Hors Horaires',
        position: { x: 760, y: 860 },
        data: {
          message: 'Notre équipe technique est actuellement absente. Laissez-nous votre email ou numéro de téléphone et nous reviendrons vers vous en priorité dès demain matin à 9h.'
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'node_trigger', target: 'node_ask_browser' },
      { id: 'e2', source: 'node_ask_browser', sourceHandle: 'opt_chrome', target: 'node_help_chrome' },
      { id: 'e3', source: 'node_ask_browser', sourceHandle: 'opt_edge', target: 'node_help_edge' },
      { id: 'e4', source: 'node_ask_browser', sourceHandle: 'opt_firefox', target: 'node_help_firefox' },
      { id: 'e5', source: 'node_ask_browser', sourceHandle: 'opt_safari', target: 'node_help_safari' },
      { id: 'e6', source: 'node_help_chrome', target: 'node_satisfaction' },
      { id: 'e7', source: 'node_help_edge', target: 'node_satisfaction' },
      { id: 'e8', source: 'node_help_firefox', target: 'node_satisfaction' },
      { id: 'e9', source: 'node_help_safari', target: 'node_satisfaction' },
      { id: 'e10', source: 'node_satisfaction', sourceHandle: 'opt_yes', target: 'node_resolved_msg' },
      { id: 'e11', source: 'node_satisfaction', sourceHandle: 'opt_no', target: 'node_check_hours' },
      { id: 'e12', source: 'node_check_hours', sourceHandle: 'open', target: 'node_assign_agent' },
      { id: 'e13', source: 'node_check_hours', sourceHandle: 'closed', target: 'node_offline_msg' }
    ]
  },
  {
    id: 'vwf_leads_qualification',
    name: '🚀 Qualification Commerciale & Devis Sur-Mesure',
    description: 'Détecte les demandes de tarifs, qualifie la taille de l’entreprise et transmet immédiatement la fiche au pôle commercial.',
    enabled: true,
    execution_count: 89,
    last_executed_at: new Date(Date.now() - 3600000).toISOString(),
    nodes: [
      {
        id: 'node_trig_lead',
        type: 'trigger',
        title: '⚡ Intention Tarifs / Forfait',
        position: { x: 420, y: 40 },
        data: {
          triggerType: 'intent_detected',
          triggerValue: 'pricing_subscription',
          keywords: ['tarif', 'prix', 'devis', 'combien', 'forfait', 'abonnement', 'offre']
        }
      },
      {
        id: 'node_msg_lead_intro',
        type: 'message',
        title: '💬 Accueil Commercial',
        position: { x: 420, y: 160 },
        data: {
          message: 'Bonjour ! Nous proposons des formules adaptées à chaque volume d’activité. Pour vous orienter précisément :'
        }
      },
      {
        id: 'node_ask_volume',
        type: 'buttons',
        title: '📊 Volume de conversations mensuel ?',
        position: { x: 420, y: 300 },
        data: {
          question: 'Combien de conversations ou visiteurs traitez-vous par mois ?',
          options: [
            { id: 'vol_starter', label: 'Moins de 500 / mois (Starter)', targetNodeId: 'node_plan_starter' },
            { id: 'vol_growth', label: '500 à 5 000 / mois (Pro)', targetNodeId: 'node_plan_pro' },
            { id: 'vol_enterprise', label: 'Plus de 5 000 / mois (Entreprise)', targetNodeId: 'node_plan_ent' }
          ]
        }
      },
      {
        id: 'node_plan_starter',
        type: 'message',
        title: '✨ Offre Starter (49€/mois)',
        position: { x: 120, y: 480 },
        data: {
          message: 'La formule Starter (49€/mois) inclut l’IA Mistral souveraine, jusqu’à 3 agents et l’accès complet à l’Inbox temps réel.'
        }
      },
      {
        id: 'node_plan_pro',
        type: 'message',
        title: '✨ Offre Pro (149€/mois)',
        position: { x: 420, y: 480 },
        data: {
          message: 'La formule Pro (149€/mois) offre des agents illimités, la téléphonie VoIP Quicktalk, les intégrations e-commerce et le Copilot IA.'
        }
      },
      {
        id: 'node_plan_ent',
        type: 'message',
        title: '🏢 Formule Entreprise / Sur-mesure',
        position: { x: 720, y: 480 },
        data: {
          message: 'Pour les grands volumes, nous offrons un SLA dédié 99.9%, un serveur dédié UE et un accompagnement à l’intégration.'
        }
      },
      {
        id: 'node_tag_lead',
        type: 'action',
        title: '🏷️ Tag Lead & Alerte Commerciale',
        position: { x: 420, y: 660 },
        data: {
          actionType: 'add_tag',
          actionPayload: 'Lead Chaud Commercial'
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'node_trig_lead', target: 'node_msg_lead_intro' },
      { id: 'e2', source: 'node_msg_lead_intro', target: 'node_ask_volume' },
      { id: 'e3', source: 'node_ask_volume', sourceHandle: 'vol_starter', target: 'node_plan_starter' },
      { id: 'e4', source: 'node_ask_volume', sourceHandle: 'vol_growth', target: 'node_plan_pro' },
      { id: 'e5', source: 'node_ask_volume', sourceHandle: 'vol_enterprise', target: 'node_plan_ent' },
      { id: 'e6', source: 'node_plan_starter', target: 'node_tag_lead' },
      { id: 'e7', source: 'node_plan_pro', target: 'node_tag_lead' },
      { id: 'e8', source: 'node_plan_ent', target: 'node_tag_lead' }
    ]
  },
  {
    id: 'vwf_ecommerce_order',
    name: '📦 E-commerce : Suivi Colis & Retours 14 Jours',
    description: 'Permet au client de choisir entre suivre sa commande ou déclarer un retour produit en toute autonomie.',
    enabled: true,
    execution_count: 215,
    last_executed_at: new Date(Date.now() - 7200000).toISOString(),
    nodes: [
      {
        id: 'node_trig_ecom',
        type: 'trigger',
        title: '⚡ Intention Commande ou Retours',
        position: { x: 400, y: 40 },
        data: {
          triggerType: 'intent_detected',
          triggerValue: 'orders_shipping',
          keywords: ['colis', 'suivi', 'commande', 'livraison', 'retour', 'rembourser']
        }
      },
      {
        id: 'node_ask_ecom',
        type: 'buttons',
        title: '🛍️ Que souhaitez-vous faire ?',
        position: { x: 400, y: 160 },
        data: {
          question: 'Bonjour ! Comment pouvons-nous vous assister sur votre commande ?',
          options: [
            { id: 'opt_tracking', label: '📦 Suivre ma livraison', targetNodeId: 'node_tracking_msg' },
            { id: 'opt_return', label: '↩️ Retourner un article (14j)', targetNodeId: 'node_return_msg' },
            { id: 'opt_human', label: '🧑‍💻 Parler à un conseiller', targetNodeId: 'node_human_action' }
          ]
        }
      },
      {
        id: 'node_tracking_msg',
        type: 'message',
        title: '📦 Suivi de Commande',
        position: { x: 150, y: 340 },
        data: {
          message: 'Indiquez votre numéro de commande (#1234) ou votre adresse email pour recevoir l’état en direct de votre colis.'
        }
      },
      {
        id: 'node_return_msg',
        type: 'message',
        title: '↩️ Procédure de Retours',
        position: { x: 400, y: 340 },
        data: {
          message: 'Vous disposez de 14 jours après réception pour renvoyer votre article. Le produit doit être dans son emballage d’origine.'
        }
      },
      {
        id: 'node_human_action',
        type: 'action',
        title: '🧑‍💻 Transfert Conseiller',
        position: { x: 680, y: 340 },
        data: {
          actionType: 'add_tag',
          actionPayload: 'SAV E-commerce'
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'node_trig_ecom', target: 'node_ask_ecom' },
      { id: 'e2', source: 'node_ask_ecom', sourceHandle: 'opt_tracking', target: 'node_tracking_msg' },
      { id: 'e3', source: 'node_ask_ecom', sourceHandle: 'opt_return', target: 'node_return_msg' },
      { id: 'e4', source: 'node_ask_ecom', sourceHandle: 'opt_human', target: 'node_human_action' }
    ]
  }
];
