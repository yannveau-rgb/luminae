import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { signAttachments } from '@/lib/storage';
import { enforce, WIDGET_RULES } from '@/lib/rate-limit';
import { isUuid } from '@/lib/utils';
import type { Attachment, WidgetSettings } from '@/lib/types';

/** Extrait et valide l'identifiant de session anonyme Supabase éventuel. */
async function extractAuthUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const jwt = authHeader.slice(7).trim();
  if (!jwt) return null;
  const db = supabaseAdmin();
  const { data: { user }, error } = await db.auth.getUser(jwt);
  if (error || !user) return null;
  return user.id;
}

/**
 * POST /api/widget/session
 * Ouvre (ou reprend) la session visiteur : crée ou associe le visiteur,
 * retourne les réglages publics du bot + la conversation active éventuelle.
 * L'abonnement Realtime s'appuie sur la session anonyme Supabase (S-05).
 */
export async function POST(req: Request) {
  try {
    const authUserId = await extractAuthUserId(req);
    const body = await req.json().catch(() => ({}));
    const { token } = body;
    if (!isUuid(token)) {
      return NextResponse.json({ error: 'Token visiteur invalide.' }, { status: 400 });
    }

    const limited = await enforce(WIDGET_RULES.session, req, token);
    if (limited) return limited;

    const db = supabaseAdmin();

    // Visiteur (création ou dernier accès).
    // upsert idempotent sur `token` : associe également auth_user_id si disponible.
    const visitorPayload: Record<string, any> = { token, last_seen_at: new Date().toISOString() };
    if (authUserId) visitorPayload.auth_user_id = authUserId;

    let { data: visitor, error: upsertErr } = await db
      .from('visitors')
      .upsert(visitorPayload, { onConflict: 'token' })
      .select('*')
      .single();
    if (upsertErr) console.error('[widget/session] upsert error', upsertErr);
    if (!visitor) {
      // Repli : l'upsert peut ne rien retourner selon la config ; on relit.
      const { data: existing, error: selectErr } = await db.from('visitors').select('*').eq('token', token).maybeSingle();
      if (selectErr) console.error('[widget/session] select error', selectErr);
      visitor = existing;
      if (visitor && authUserId && !visitor.auth_user_id) {
        await db.from('visitors').update({ auth_user_id: authUserId }).eq('id', visitor.id);
        visitor.auth_user_id = authUserId;
      }
    }
    if (!visitor) {
      return NextResponse.json({ error: 'Visiteur introuvable.' }, { status: 500 });
    }

    // Réglages publics du bot.
    const { data: s } = await db.from('bot_settings').select('*').eq('id', 1).maybeSingle();
    const settings: WidgetSettings = {
      bot_name: s?.bot_name ?? 'Assistant',
      avatar_url: s?.avatar_url ?? null,
      welcome_message: s?.welcome_message ?? 'Bonjour 👋 Comment puis-je vous aider ?',
      accent_color: s?.accent_color ?? '#0E8C7D',
      suggestions: (Array.isArray(s?.suggestions) ? s!.suggestions : []) as unknown as string[],
      privacy_url: s?.privacy_url ?? null
    };

    // Conversation active (non résolue) ?
    const { data: conv } = await db
      .from('conversations')
      .select('*')
      .eq('visitor_id', visitor.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const active = conv && conv.status !== 'resolved' ? conv : null;

    let messages: any[] = [];
    let feedback: Record<string, string> = {};
    if (active) {
      const { data: msgs } = await db
        .from('messages')
        .select('*')
        .eq('conversation_id', active.id)
        .neq('internal_note', true)
        .order('created_at', { ascending: true });
      messages = msgs ?? [];

      // Pièces jointes signées (ex. capture envoyée par un agent).
      const ids = messages.map((m) => m.id);
      if (ids.length > 0) {
        const { data: atts } = await db.from('attachments').select('*').in('message_id', ids);
        if (atts && atts.length > 0) {
          const signed = await signAttachments(atts as Attachment[]);
          const byMsg = new Map<string, (Attachment & { url: string | null })[]>();
          for (const a of signed) {
            if (!a.message_id) continue;
            (byMsg.get(a.message_id) ?? byMsg.set(a.message_id, []).get(a.message_id)!).push(a);
          }
          messages = messages.map((m) => ({ ...m, attachments: byMsg.get(m.id) ?? [] }));
        }
      }

      const botIds = messages.filter((m) => m.sender === 'bot').map((m) => m.id);
      if (botIds.length > 0) {
        const { data: fb } = await db
          .from('message_feedback')
          .select('message_id, value')
          .in('message_id', botIds);
        for (const f of fb ?? []) feedback[f.message_id] = f.value;
      }
    }

    // Identifiant du canal Realtime. S'il n'y a pas de conversation active, on
    // en pré-alloue un côté serveur : le widget peut ainsi s'abonner AVANT
    // d'envoyer son premier message (sinon il raterait la réponse du bot), sans
    // que le client ait à choisir lui-même une clé primaire.
    // Configuration téléphonie & Quicktalk
    const store = (s?.suggestions && typeof s.suggestions === 'object' && !Array.isArray(s.suggestions))
      ? (s.suggestions as Record<string, unknown>)
      : {};
    const telephony = store.telephony ?? null;

    return NextResponse.json({
      visitorId: visitor.id,
      visitorName: visitor.display_name,
      settings,
      telephony,
      conversation: active,
      messages,
      feedback,
      conversationId
    });
  } catch (err: any) {
    console.error('[widget/session]', err);
    return NextResponse.json({ error: 'Impossible de charger la session.' }, { status: 500 });
  }
}
