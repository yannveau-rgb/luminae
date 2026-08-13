/**
 * Configuration Next.js — en-têtes de sécurité.
 *
 * Deux surfaces aux besoins opposés :
 *  - /widget est chargé en iframe sur les sites clients : il DOIT être cadrable,
 *    mais seulement par les domaines autorisés.
 *  - tout le reste (back-office agent, administration) ne doit jamais être cadré.
 */

const SUPABASE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

/**
 * La CSP n'est posée qu'en production : en développement, le rechargement à
 * chaud de Next ouvre un WebSocket vers localhost que `connect-src 'self'` ne
 * couvre pas de façon fiable selon les navigateurs, ce qui casserait le HMR.
 * Les autres en-têtes, eux, s'appliquent partout.
 */
const CSP_ENABLED = process.env.NODE_ENV === 'production';

/**
 * Domaines autorisés à intégrer le widget, séparés par des virgules.
 * Ex. WIDGET_ALLOWED_ORIGINS="https://client-a.fr,https://www.client-b.com"
 *
 * Non renseignée, la variable laisse l'intégration ouverte à tous les domaines —
 * c'est le comportement historique, conservé pour ne pas couper sans préavis les
 * sites clients déjà équipés. Un avertissement est émis au build : dès que la
 * liste des domaines est connue, la renseigner ferme la porte (constat S-03).
 */
function frameAncestors() {
  const raw = (process.env.WIDGET_ALLOWED_ORIGINS ?? '').trim();
  if (!raw) {
    console.warn(
      '[luminae] WIDGET_ALLOWED_ORIGINS non définie — le widget reste intégrable par n’importe quel domaine.'
    );
    return "'self' *";
  }
  const origins = raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return ["'self'", ...origins].join(' ');
}

/**
 * Politique de sécurité du contenu.
 *
 * `script-src` conserve 'unsafe-inline' et 'unsafe-eval' : l'App Router injecte
 * des scripts inline pour l'hydratation, et les bloquer casserait le rendu. La
 * CSP verrouille donc surtout l'exfiltration (connect-src), les injections de
 * balise (object-src, base-uri) et le détournement de formulaire — c'est une
 * défense en profondeur, pas une barrière anti-XSS à elle seule. Pour un vrai
 * verrou, l'étape suivante est un nonce par requête posé dans un middleware.
 */
function contentSecurityPolicy({ frameable }) {
  if (!CSP_ENABLED) return null;
  const supabaseWs = SUPABASE_ORIGIN.replace(/^https:/, 'wss:');
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `img-src 'self' data: blob: ${SUPABASE_ORIGIN}`.trim(),
    `connect-src 'self' ${SUPABASE_ORIGIN} ${supabaseWs}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    frameable ? `frame-ancestors ${frameAncestors()}` : "frame-ancestors 'none'",
    'upgrade-insecure-requests'
  ].join('; ');
}

/** En-têtes appliqués partout. */
const BASE_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }
];

/** Écarte les en-têtes dont la valeur est nulle (CSP désactivée en dev). */
function headerSet(...entries) {
  return entries.flat().filter((h) => h && h.value);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Le widget est cadrable, mais uniquement par les domaines autorisés.
        // `frame-ancestors` remplace l'ancien X-Frame-Options: ALLOWALL, qui
        // n'était pas une valeur valide de l'en-tête (donc ignorée par les
        // navigateurs) et n'offrait de toute façon aucune liste blanche.
        source: '/widget',
        headers: headerSet(BASE_HEADERS, {
          key: 'Content-Security-Policy',
          value: contentSecurityPolicy({ frameable: true })
        })
      },
      {
        source: '/embed.js',
        headers: headerSet(BASE_HEADERS, { key: 'Cache-Control', value: 'public, max-age=300' })
      },
      {
        // Back-office et pages publiques : jamais cadrables.
        source: '/((?!widget$|embed\\.js$).*)',
        headers: headerSet(
          BASE_HEADERS,
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy({ frameable: false }) }
        )
      }
    ];
  }
};

export default nextConfig;
