import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { broadcast } from '@/lib/broadcast';
import { sanitizeHtml } from '@/lib/sanitize';
import { signAttachments } from '@/lib/storage';
import type { Database } from '@/lib/supabase/database.types';
import type { Attachment } from '@/lib/types';

type ConvUpdate = Database['public']['Tables']['conversations']['Update'];

interface AttachmentInput {
  storage_path: string;
  file_name?: string;
  mime_type?: string;
  size_bytes?: number;
}

/** Texte brut dérivé d'un HTML (pour la colonne `content`, l'IA, les notifs). */
function htmlToText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/div|\/li)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * POST /api/agent/messages
 * Message d'un agent (ou note interne) dans une conversation.
 * Une réponse sur une conversation « waiting »/« bot » vaut prise en charge.
 */
export async function POST(req: Request) {
  try {
    const agent = await requireAgent();
    const body = await req.json().catch(() => ({}));
    const { conversationId, content, contentHtml, internalNote, attachments } = body as {
      conversationId?: string;
      content?: string;
      contentHtml?: string;
      internalNote?: boolean;
      attachments?: AttachmentInput[];
    };

    // Contenu riche éventuel : on sanitise le HTML et on dérive le texte brut.
    const rawHtml = (contentHtml ?? '').toString();
    const safeHtml = rawHtml ? sanitizeHtml(rawHtml).slice(0, 8000) : '';
    const text = (safeHtml ? htmlToText(safeHtml) : (content ?? '').toString().trim()).slice(0, 4000);
    const files = (Array.isArray(attachments) ? attachments : [])
      .filter((a) => a && typeof a.storage_path === 'string')
      .slice(0, 10);

    // Un message doit avoir du texte OU au moins une pièce jointe.
    if (!conversationId || (!text && files.length === 0)) {
      return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data: conv } = await db.from('conversations').select('*').eq('id', conversationId).maybeSingle();
    if (!conv) {
      return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 });
    }

    const { data: msg, error: msgErr } = await db
      .from('messages')
      .insert({
        conversation_id: conv.id,
        sender: 'agent',
        agent_id: agent.id,
        content: text || (files.length ? '(pièce jointe)' : ''),
        content_html: safeHtml && safeHtml !== text ? safeHtml : null,
        internal_note: !!internalNote
      })
      .select('*')
      .single();
    if (msgErr) throw new Error(msgErr.message);

    // Enregistrement des pièces jointes rattachées à ce message.
    let signedFiles: (Attachment & { url: string | null })[] = [];
    if (files.length > 0) {
      const { data: inserted } = await db
        .from('attachments')
        .insert(
          files.map((f) => ({
            message_id: msg.id,
            storage_path: f.storage_path,
            file_name: f.file_name ?? null,
            mime_type: f.mime_type ?? null,
            size_bytes: typeof f.size_bytes === 'number' ? f.size_bytes : null
          }))
        )
        .select('*');
      signedFiles = await signAttachments((inserted ?? []) as Attachment[]);
    }

    // Prise en charge automatique + remise à zéro des non-lus.
    const patch: ConvUpdate = { updated_at: new Date().toISOString(), unread_count: 0 };
    if (!internalNote && (conv.status === 'waiting' || conv.status === 'bot')) {
      patch.status = 'assigned';
      patch.assigned_agent_id = agent.id;
    }
    const { data: fresh, error: upErr } = await db
      .from('conversations')
      .update(patch)
      .eq('id', conv.id)
      .select('*')
      .single();
    if (upErr || !fresh) throw new Error(upErr?.message ?? 'Mise à jour impossible.');

    const enriched = { ...msg, agent_name: agent.full_name, attachments: signedFiles };
    await broadcast(`conv:${conv.id}`, internalNote ? 'note:new' : 'message:new', enriched);
    await broadcast(`conv:${conv.id}`, 'conversation:update', {
      id: fresh.id,
      status: fresh.status,
      assigned_agent_id: fresh.assigned_agent_id,
      unread_count: fresh.unread_count
    });
    await broadcast('inbox:all', 'inbox:update', { conversation_id: fresh.id });

    return NextResponse.json({ message: enriched, conversation: fresh });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[agent/messages]', err);
    return NextResponse.json({ error: 'Le message n’a pas pu être envoyé.' }, { status: 500 });
  }
}