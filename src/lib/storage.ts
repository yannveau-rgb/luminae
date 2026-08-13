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

/** Génère les URLs signées (lecture temporaire) pour une liste de pièces jointes. */
export async function signAttachments(rows: Attachment[]): Promise<(Attachment & { url: string | null })[]> {
  if (rows.length === 0) return [];
  const paths = rows.map((r) => r.storage_path);
  const { data } = await supabaseAdmin().storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
  const urlByPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => ({ ...r, url: urlByPath.get(r.storage_path) ?? null }));
}
