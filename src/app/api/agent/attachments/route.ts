import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ALLOWED_MIME, MAX_ATTACHMENT_BYTES, uploadAttachment } from '@/lib/storage';

export const maxDuration = 60;

/**
 * POST /api/agent/attachments  (multipart/form-data : file, conversationId)
 * Téléverse une pièce jointe dans le bucket privé et renvoie son descripteur.
 * L'attachement n'est lié à aucun message tant que l'agent n'a pas envoyé (le
 * message référence ensuite ce storage_path).
 */
export async function POST(req: Request) {
  try {
    await requireAgent();
    const form = await req.formData();
    const file = form.get('file');
    const conversationId = (form.get('conversationId') ?? '').toString();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Aucun fichier.' }, { status: 400 });
    }
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation manquante.' }, { status: 400 });
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo).' }, { status: 413 });
    }
    if (file.type && !ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: 'Type de fichier non autorisé.' }, { status: 415 });
    }

    // Vérifie que la conversation existe (évite d'écrire des orphelins).
    const { data: conv } = await supabaseAdmin()
      .from('conversations').select('id').eq('id', conversationId).maybeSingle();
    if (!conv) return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const descriptor = await uploadAttachment(conversationId, {
      name: file.name || 'fichier',
      type: file.type || 'application/octet-stream',
      bytes
    });

    return NextResponse.json({ attachment: descriptor });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[agent/attachments]', err);
    return NextResponse.json({ error: 'Le téléversement a échoué.' }, { status: 500 });
  }
}
