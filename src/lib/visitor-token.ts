import { createHmac } from 'node:crypto';

/**
 * Jeton Realtime du visiteur.
 *
 * Les canaux Realtime sont désormais privés (migration 0010) : Realtime vérifie
 * chaque abonnement contre les policies de `realtime.messages`. Le widget ne
 * peut donc plus s'abonner avec la clé anon nue — il présente un JWT court,
 * signé côté serveur, portant la revendication `conversation_id`. La policy
 * n'autorise alors que le canal `conv:{cette conversation}`.
 *
 * Signé en HS256 avec le secret JWT du projet Supabase
 * (Dashboard → Project Settings → API → JWT Secret). Implémenté avec le module
 * `crypto` de Node pour éviter une dépendance supplémentaire.
 */

/** Durée de vie du jeton. Court : le widget en redemande à chaque session. */
const TTL_SECONDS = 60 * 60; // 1 h

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function secret(): string {
  const value = process.env.SUPABASE_JWT_SECRET;
  if (!value) {
    throw new Error(
      'SUPABASE_JWT_SECRET manquante — nécessaire pour signer les jetons Realtime du widget.'
    );
  }
  return value;
}

/**
 * Émet un JWT autorisant le visiteur à recevoir les diffusions de sa seule
 * conversation. Le rôle `anon` correspond à la policy « visiteur recoit sa
 * conversation » ; aucune permission de lecture directe des tables n'en découle
 * (le RLS reste en refus total).
 */
export function mintVisitorToken(params: {
  visitorId: string;
  conversationId: string;
}): { token: string; expiresIn: number } {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    role: 'anon',
    sub: params.visitorId,
    conversation_id: params.conversationId,
    iat: now,
    exp: now + TTL_SECONDS
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = base64url(createHmac('sha256', secret()).update(signingInput).digest());

  return { token: `${signingInput}.${signature}`, expiresIn: TTL_SECONDS };
}

/**
 * Variante tolérante : renvoie null au lieu de lever si le secret n'est pas
 * configuré, pour qu'un déploiement incomplet dégrade le temps réel sans casser
 * l'ouverture de session (le widget retombe alors sur le rechargement manuel).
 */
export function tryMintVisitorToken(params: {
  visitorId: string;
  conversationId: string;
}): { token: string; expiresIn: number } | null {
  try {
    return mintVisitorToken(params);
  } catch (err) {
    console.error('[visitor-token]', err instanceof Error ? err.message : err);
    return null;
  }
}
