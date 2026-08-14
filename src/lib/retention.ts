import { supabaseAdmin } from './supabase/admin';
import { removeAttachments } from './storage';

/**
 * Conservation et effacement des données de conversation.
 *
 * La plateforme traite des échanges de candidats à des évaluations — donc des
 * données personnelles dans un contexte sensible — et la page d'accueil affiche
 * « Conformité ». Or il n'existait aucune politique de purge, aucun moyen
 * d'effacer, et aucune information sur le traitement par IA (constat S-11).
 * L'hébergement en UE, seul, ne couvre pas ces obligations.
 *
 * Deux mécanismes distincts :
 *  - `purgeExpired()`  — conservation limitée, exécutée périodiquement ;
 *  - `eraseVisitor()`  — droit à l'effacement, à la demande du visiteur.
 *
 * Dans les deux cas, les fichiers du bucket sont supprimés AVANT les lignes :
 * la cascade SQL ne touche pas au stockage objet, et l'ordre inverse laisserait
 * des pièces jointes orphelines impossibles à retrouver.
 */

/** Durée de conservation d'une conversation résolue. */
export const RETENTION_MONTHS = 12;

/** Durée au-delà de laquelle un visiteur sans conversation est effacé. */
export const ORPHAN_VISITOR_MONTHS = 6;

export interface PurgeReport {
  conversations: number;
  visiteurs: number;
  fichiers: number;
}

function moisAvant(mois: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - mois);
  return d.toISOString();
}

/**
 * Récupère les chemins de stockage des pièces jointes rattachées à un ensemble
 * de conversations. Passe par les messages, `attachments` n'ayant pas de lien
 * direct vers la conversation.
 */
async function cheminsDesPieces(conversationIds: string[]): Promise<string[]> {
  if (conversationIds.length === 0) return [];
  const db = supabaseAdmin();

  const { data: messages } = await db
    .from('messages')
    .select('id')
    .in('conversation_id', conversationIds);
  const messageIds = (messages ?? []).map((m) => m.id);
  if (messageIds.length === 0) return [];

  const chemins: string[] = [];
  // Par lots : `in` sur plusieurs milliers d'ids dépasse la longueur d'URL.
  for (let i = 0; i < messageIds.length; i += 200) {
    const { data } = await db
      .from('attachments')
      .select('storage_path')
      .in('message_id', messageIds.slice(i, i + 200));
    for (const a of data ?? []) if (a.storage_path) chemins.push(a.storage_path);
  }
  return chemins;
}

/**
 * Applique la politique de conservation.
 * Idempotent : réexécutable sans effet de bord si rien n'a expiré.
 */
export async function purgeExpired(): Promise<PurgeReport> {
  const db = supabaseAdmin();
  const limite = moisAvant(RETENTION_MONTHS);

  // Conversations résolues depuis plus longtemps que la durée de conservation.
  // `resolved_at` peut être nul sur d'anciennes lignes : on retombe sur
  // `updated_at`, qui est renseigné par trigger.
  const { data: resolues } = await db
    .from('conversations')
    .select('id')
    .eq('status', 'resolved')
    .or(`resolved_at.lt.${limite},and(resolved_at.is.null,updated_at.lt.${limite})`);

  const ids = (resolues ?? []).map((c) => c.id);

  const chemins = await cheminsDesPieces(ids);
  await removeAttachments(chemins);

  if (ids.length > 0) {
    // Messages, pièces jointes et feedbacks partent en cascade.
    for (let i = 0; i < ids.length; i += 200) {
      await db.from('conversations').delete().in('id', ids.slice(i, i + 200));
    }
  }

  // Visiteurs sans aucune conversation et inactifs depuis longtemps.
  const { data: candidats } = await db
    .from('visitors')
    .select('id')
    .lt('last_seen_at', moisAvant(ORPHAN_VISITOR_MONTHS));

  let visiteursSupprimes = 0;
  for (const v of candidats ?? []) {
    const { count } = await db
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('visitor_id', v.id);
    if ((count ?? 0) === 0) {
      await db.from('visitors').delete().eq('id', v.id);
      visiteursSupprimes++;
    }
  }

  return { conversations: ids.length, visiteurs: visiteursSupprimes, fichiers: chemins.length };
}

/**
 * Droit à l'effacement : supprime le visiteur porteur de ce token et tout ce
 * qui s'y rattache. Irréversible.
 */
export async function eraseVisitor(token: string): Promise<PurgeReport | null> {
  const db = supabaseAdmin();

  const { data: visitor } = await db.from('visitors').select('id').eq('token', token).maybeSingle();
  if (!visitor) return null;

  const { data: convs } = await db.from('conversations').select('id').eq('visitor_id', visitor.id);
  const ids = (convs ?? []).map((c) => c.id);

  const chemins = await cheminsDesPieces(ids);
  await removeAttachments(chemins);

  // La suppression du visiteur emporte ses conversations en cascade
  // (`on delete cascade` sur `conversations.visitor_id`), et de là les messages.
  await db.from('visitors').delete().eq('id', visitor.id);

  return { conversations: ids.length, visiteurs: 1, fichiers: chemins.length };
}
