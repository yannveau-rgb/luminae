/**
 * BRANDING / CONFIGURATION DU TENANT
 * -----------------------------------
 * C'est le SEUL endroit du code où des éléments spécifiques au client
 * déployé peuvent apparaître. Tout le reste de l'application
 * est neutre et lit ses valeurs dans la table `bot_settings` (modifiable
 * depuis l'administration sans toucher au code).
 *
 * Ces valeurs servent de :
 *  - défauts au seed SQL (première installation),
 *  - repli si la table `bot_settings` n'est pas encore initialisée.
 *
 * Pour un futur déploiement SaaS chez un autre client, il suffit de
 * remplacer ce fichier (ou d'alimenter `bot_settings` via l'admin).
 */

export const branding = {
  /** Identité du tenant (affichée sur la page de connexion / landing). */
  tenant: {
    name: 'Luminae',
    description:
      'Coordination d’évaluations et d’examens de candidats : supervision à distance, planification et communication.'
  },

  /** Identité du bot (seed de bot_settings). */
  bot: {
    name: 'Lumi',
    welcomeMessage:
      'Bonjour 👋 Je suis Lumi, votre assistant. Posez-moi votre question sur vos évaluations, convocations ou résultats — je réponds instantanément, et un membre de l’équipe peut prendre le relais si besoin.',
    fallbackMessage:
      'Je préfère laisser un membre de l’équipe vous répondre pour ne pas vous induire en erreur. Je viens de transmettre votre demande — un agent vous répond ici très vite.',
    offlineMessage:
      'Nos agents ne sont pas disponibles pour le moment. Votre question est bien en file d’attente, nous y répondrons dès notre retour.',
    tone: 'casual' as 'formal' | 'casual',
    replyLength: 'normal' as 'concise' | 'normal' | 'detailed',
    smallTalkEnabled: true,
    accentColor: '#0E8C7D',
    suggestions: [
      'Comment se déroule un examen supervisé ?',
      'Quand vais-je recevoir ma convocation ?',
      'Comment récupérer mes résultats ?'
    ]
  },

  /** Horaires par défaut de l'équipe (seed de business_hours). */
  hours: {
    timezone: 'Europe/Paris',
    weekly: {
      monday: [['09:00', '12:30'], ['14:00', '18:00']],
      tuesday: [['09:00', '12:30'], ['14:00', '18:00']],
      wednesday: [['09:00', '12:30'], ['14:00', '18:00']],
      thursday: [['09:00', '12:30'], ['14:00', '18:00']],
      friday: [['09:00', '12:30'], ['14:00', '17:00']],
      saturday: [],
      sunday: []
    } as Record<string, [string, string][]>,
    holidays: [
      { date: '2026-12-25', name: 'Noël' },
      { date: '2027-01-01', name: 'Jour de l’an' }
    ] as { date: string; name: string }[]
  },

  /** Compte admin initial créé au seed (à remplacer avant tout déploiement réel). */
  seedAdmin: {
    email: 'admin@luminae.example',
    fullName: 'Administrateur Luminae',
    temporaryPassword: 'Luminae-Admin-2026!'
  }
};

export type Branding = typeof branding;
