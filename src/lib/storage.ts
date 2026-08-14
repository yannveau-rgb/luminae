import { supabaseAdmin } from './supabase/admin';
import type { Attachment } from './types';

const BUCKET = 'attachments';
const SIGNED_TTL = 60 * 60; // 1 h

/** Types de fichiers acceptés en pièce jointe (images + documents courants). */
export const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 Mo

/** Téléverse un fichier dans le bucket privé et renvoie son descripteur. */
export async function uploadAttachment(
  conversationId: string,
  file: { name: string; type: string; bytes: Uint8Array }
): Promise<{ storage_path: string; file_name: string; mime_type: string; size_bytes: number }> {
  const safeName = file.name.replace(/[^\w.\-]/g, '_').slice(-80) || 'fichier';
  const rand = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const path = `conversations/${conversationId}/${rand}-${safeName}`;

  const { error } = await supabaseAdmin()
    .storage.from(BUCKET)
    .upload(path, file.bytes, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);

  return { storage_path: path, file_name: safeName, mime_type: file.type, size_bytes: file.bytes.byteLength };
}

/**
 * Liste tous les chemins présents dans le bucket, avec leur date de création.
 *
 * Nécessaire pour retrouver les fichiers orphelins : un téléversement écrit
 * dans le stockage, mais la ligne `attachments` n'est créée qu'à l'envoi du
 * message. Un fichier joint puis abandonné n'a donc AUCUNE trace en base — il
 * est invisible depuis SQL et survivait indéfiniment (constat S-13).
 *
 * L'arborescence est `conversations/{conversationId}/{fichier}` : on parcourt
 * les dossiers puis leur contenu. `limite` borne le nombre de dossiers examinés
 * par passage, pour qu'un bucket volumineux n'épuise pas le temps d'exécution.
 */
export async function listerFichiers(
  limite = 500
): Promise<{ path: string; created_at: string | null }[]> {
  const storage = supabaseAdmin().storage.from(BUCKET);

  const { data: dossiers, error } = await storage.list('conversations', { limit: limite });
  if (error) throw new Error(error.message);

  const resultats: { path: string; created_at: string | null }[] = [];
  for (const dossier of dossiers ?? []) {
    // `id` nul distingue un dossier d'un objet.
    if (dossier.id !== null) continue;
    const { data: fichiers } = await storage.list(`conversations/${dossier.name}`, { limit: 1000 });
    for (const f of fichiers ?? []) {
      if (f.id === null) continue;
      resultats.push({
        path: `conversations/${dossier.name}/${f.name}`,
        created_at: f.created_at ?? null
      });
    }
  }
  return resultats;
}

/**
 * Supprime des fichiers du bucket.
 *
 * Indispensable avant d'effacer les lignes `attachments` : la cascade SQL ne
 * touche pas au stockage objet, et les fichiers survivraient indéfiniment à la
 * conversation qui les portait — ce qui viderait de sens toute politique de
 * conservation comme tout droit à l'effacement.
 */
export async function removeAttachments(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  // La suppression se fait par lots : l'API n'aime pas les listes trop longues.
  for (let i = 0; i < paths.length; i += 100) {
    const lot = paths.slice(i, i + 100);
    const { error } = await supabaseAdmin().storage.from(BUCKET).remove(lot);
    if (error) throw new Error(error.message);
  }
}

/** Génère les URLs signées (lecture temporaire) pour une liste de pièces jointes. */
export async function signAttachments(rows: Attachment[]): Promise<(Attachment & { url: string | null })[]> {
  if (rows.length === 0) return [];
  const paths = rows.map((r) => r.storage_path);
  const { data } = await supabaseAdmin().storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
  const urlByPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => ({ ...r, url: urlByPath.get(r.storage_path) ?? null }));
}
