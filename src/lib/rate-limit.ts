import { supabaseAdmin } from './supabase/admin';

/**
 * Limitation de débit des routes publiques du widget.
 *
 * Le compteur est en base (fonction `rate_limit_hit`, migration 0011) et non en
 * mémoire : les fonctions serverless sont sans état et réparties sur plusieurs
 * instances, un compteur local ne limiterait rien.
 *
 * En cas d'indisponibilité de la base, on laisse passer (fail-open) : mieux vaut
 * un quota temporairement inopérant qu'un widget hors service.
 */

export interface RateRule {
  /** Préfixe du seau, décrit l'action limitée (ex. « msg »). */
  action: string;
  /** Nombre d'appels autorisés par fenêtre. */
  limit: number;
  /** Durée de la fenêtre, en secondes. */
  windowSeconds: number;
}

/** Quotas appliqués aux routes widget. */
export const WIDGET_RULES = {
  /** Envoi d'un message : déclenche embedding + complétion Mistral. */
  message: { action: 'msg', limit: 20, windowSeconds: 600 },
  /** Ouverture/reprise de session : peu coûteux, mais borné. */
  session: { action: 'session', limit: 60, windowSeconds: 600 },
  /** Escalade explicite vers un humain. */
  escalate: { action: 'escalate', limit: 10, windowSeconds: 600 },
  /** Vote 👍/👎 sur une réponse du bot. */
  feedback: { action: 'feedback', limit: 30, windowSeconds: 600 },
  /** Indicateur de saisie : relayé souvent, throttlé côté client. */
  typing: { action: 'typing', limit: 120, windowSeconds: 600 }
} as const satisfies Record<string, RateRule>;

/**
 * Adresse de l'appelant, telle que vue derrière le proxy Vercel.
 * `x-forwarded-for` peut contenir une liste : la première entrée est le client.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'inconnu';
}

/** Consomme un jeton du seau. Retourne false si le quota est dépassé. */
export async function allow(rule: RateRule, key: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin().rpc('rate_limit_hit', {
      p_bucket: `${rule.action}:${key}`,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds
    });
    if (error) {
      console.error('[rate-limit] rate_limit_hit', error.message);
      return true; // fail-open
    }
    return data !== false;
  } catch (err) {
    console.error('[rate-limit] indisponible', err);
    return true; // fail-open
  }
}

/**
 * Applique le quota sur les deux dimensions qui comptent : l'adresse IP (empêche
 * un attaquant de contourner en régénérant des tokens) et le token visiteur
 * (empêche un réseau d'adresses de marteler une même conversation).
 * Retourne `null` si l'appel est autorisé, sinon une réponse 429 prête à renvoyer.
 */
export async function enforce(
  rule: RateRule,
  req: Request,
  token?: string
): Promise<Response | null> {
  const keys = [`ip:${clientIp(req)}`];
  if (token) keys.push(`tok:${token}`);

  const verdicts = await Promise.all(keys.map((k) => allow(rule, k)));
  if (verdicts.every(Boolean)) return null;

  return new Response(
    JSON.stringify({ error: 'Trop de requêtes — patientez quelques instants avant de réessayer.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(rule.windowSeconds)
      }
    }
  );
}
