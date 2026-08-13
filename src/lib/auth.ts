import type { Agent } from './types';
import { supabaseServer } from './supabase/server';
import { supabaseAdmin } from './supabase/admin';

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Valide la session Supabase de la requête courante et retourne l'agent.
 * Lève une AuthError(401) si non connecté, AuthError(403) si rôle insuffisant.
 */
export async function requireAgent(requiredRole?: 'admin'): Promise<Agent> {
  const supabase = supabaseServer();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();
  if (error || !user) throw new AuthError('Session requise — connectez-vous.');

  const db = supabaseAdmin();

  // Deux requêtes plutôt qu'un `.or()` construit par interpolation : l'e-mail
  // était injecté dans la grammaire de filtre PostgREST, où une virgule ou une
  // parenthèse suffit à détourner l'expression. Sur une résolution d'identité,
  // c'est le mauvais endroit pour un doute (constat S-10).
  let agent = (
    await db.from('agents').select('*').eq('auth_user_id', user.id).maybeSingle()
  ).data;

  // Repli sur l'e-mail : comptes créés avant la liaison à auth.users.
  if (!agent && user.email) {
    agent = (await db.from('agents').select('*').eq('email', user.email).maybeSingle()).data;
  }

  if (!agent) throw new AuthError('Ce compte n’a pas accès à la plateforme.', 403);
  if (requiredRole === 'admin' && agent.role !== 'admin') {
    throw new AuthError('Réservé aux administrateurs.', 403);
  }

  // Lier auth_user_id si besoin (comptes créés avant liaison).
  if (!agent.auth_user_id) {
    await db.from('agents').update({ auth_user_id: user.id }).eq('id', agent.id);
    agent.auth_user_id = user.id;
  }
  return agent as unknown as Agent;
}
