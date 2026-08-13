import type { Config } from 'tailwindcss';

/**
 * LUMINAE — Système de design « Lumen »
 * --------------------------------------
 * Palette (6 couleurs nommées) :
 *  - ink    : bleu pétrole profond (texte, surfaces sombres du back-office)
 *  - lagoon : teal primaire (actions, présence, bulles du bot)
 *  - aurora : cyan lumineux (accents secondaires, halo signature)
 *  - sun    : ambre chaleureux (notes internes, états « en attente »)
 *  - coral  : corail (erreurs, feedback négatif, escalade)
 *  - mist   : gris-bleu glacé (fonds, bordures)
 *
 * Typographie : Space Grotesk (affichage, avec parcimonie) + Inter (texte courant).
 * Élément signature : le « halo » — orbe lumineux du bot, respiration douce,
 * apparition des messages en élévation légère.
 *
 * Les couleurs d'accent du widget PUBLIC sont surchargées à la volée via
 * l'administration (bot_settings.accent_color) — jamais dupliquées ici.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0F2233',
          950: '#081624',
          900: '#0C1B2A',
          800: '#13293D',
          700: '#1D3A53',
          600: '#2C4E6C',
          500: '#46688A',
          // 400 porte les horodatages, les placeholders et les libellés d'aide,
          // c'est-à-dire du texte. L'ancien #6E8DAB plafonnait à 3,5:1 sur
          // blanc ; celui-ci atteint 4,7:1.
          400: '#5A7794',
          // 300 est réservé aux SURFACES SOMBRES (navigation admin, connexion),
          // où il donne 8:1. Sur blanc il tombe à 2,2:1 — ne pas l'y employer.
          300: '#9FB4C8'
        },
        lagoon: {
          DEFAULT: '#0E8C7D',
          700: '#0A6E62',
          600: '#0B7A6E',
          500: '#0E8C7D',
          400: '#17A593',
          300: '#5BC4B5',
          200: '#A5DED4',
          100: '#D7F0EB',
          50: '#EDF8F5'
        },
        aurora: {
          DEFAULT: '#2FC6D4',
          // 600 est le ton de PREMIER PLAN (texte du badge « Bot »). L'ancien
          // #1BA3B1 ne donnait que 2,7:1 sur aurora-100 ; celui-ci atteint
          // 4,5:1, le seuil WCAG AA. Pour un aplat décoratif, utiliser 500.
          600: '#0F7A86',
          500: '#2FC6D4',
          400: '#5EDAE5',
          300: '#9BE9F0',
          100: '#DDF7FA'
        },
        sun: {
          DEFAULT: '#F2A63B',
          /** État survolé de sun-600 en aplat (texte blanc : 7,7:1). */
          700: '#7A4700',
          // Idem : #D98A1F ne donnait que 2,4:1 sur sun-100 et 2,8:1 sur blanc.
          // #9A5B00 monte à 4,6:1 et 5,4:1, et reste lisible en aplat sous du
          // texte blanc (5,4:1) — ce que l'ambre DEFAULT ne permet pas (2,0:1).
          600: '#9A5B00',
          500: '#F2A63B',
          300: '#F8C87E',
          100: '#FCEBD1',
          50: '#FEF7EA'
        },
        coral: {
          DEFAULT: '#E25C4A',
          600: '#C7452F',
          500: '#E25C4A',
          300: '#F0A294',
          100: '#FBE3DE',
          50: '#FDF2F0'
        },
        mist: {
          DEFAULT: '#F4F7F9',
          // 50 / 100 / 200 manquaient à l'échelle alors que le code les
          // utilisait déjà : Tailwind ne générait rien, sans erreur, et les
          // fonds concernés étaient simplement absents (page d'accueil, bande
          // Copilot, survol de la liste de conversations).
          50: '#FBFCFD',
          100: '#F4F7F9',
          200: '#E9EFF3',
          300: '#DCE5EB',
          400: '#C3D1DB',
          // 500 et 600 sont des tons de BORDURE et d'icône : trop clairs pour
          // du texte sur blanc (2,2:1 et 3,1:1). Pour du texte, voir `ink`.
          500: '#9FB2C0',
          600: '#7C93A4'
        }
      },
      fontFamily: {
        display: ['"Space Grotesk Variable"', '"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        panel: '0 12px 40px -8px rgba(8, 22, 36, 0.22), 0 2px 8px rgba(8, 22, 36, 0.08)',
        bubble: '0 1px 2px rgba(8, 22, 36, 0.06), 0 6px 20px -6px rgba(8, 22, 36, 0.12)',
        // `glow` / `glow-sm` étaient employés par la page d'accueil sans jamais
        // avoir été définis : les deux appels à l'action et le bloc
        // d'intégration n'avaient donc aucune ombre. Teintés lagoon/aurora
        // plutôt que neutres — c'est la lumière qui signe le système « Lumen ».
        'glow-sm': '0 4px 16px -4px rgba(14, 140, 125, 0.34), 0 1px 3px rgba(8, 22, 36, 0.08)',
        glow: '0 14px 40px -12px rgba(47, 198, 212, 0.40), 0 2px 10px rgba(8, 22, 36, 0.14)',
        halo: '0 0 0 6px rgba(47, 198, 212, 0.12), 0 0 24px rgba(47, 198, 212, 0.35)'
      },
      keyframes: {
        'msg-in': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.985)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        'halo-breathe': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(47, 198, 212, 0.35), 0 0 18px rgba(47,198,212,0.30)' },
          '50%': { boxShadow: '0 0 0 9px rgba(47, 198, 212, 0.08), 0 0 26px rgba(47,198,212,0.45)' }
        },
        'dot-pulse': {
          '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.4' },
          '40%': { transform: 'scale(1)', opacity: '1' }
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'msg-in': 'msg-in 0.28s cubic-bezier(0.2, 0.8, 0.25, 1) both',
        'halo-breathe': 'halo-breathe 3.2s ease-in-out infinite',
        'dot-pulse': 'dot-pulse 1.2s ease-in-out infinite',
        'fade-in': 'fade-in 0.2s ease-out both',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.2, 0.8, 0.25, 1) both'
      }
    }
  },
  plugins: []
};

export default config;
