import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { signAttachments } from '@/lib/storage';
import { enforce, WIDGET_RULES } from '@/lib/rate-limit';
import { tryMintVisitorToken } from '@/lib/visitor-token';
import { isUuid } from '@/lib/utils';
import type { Attachment, WidgetSettings } from '@/lib/types';

/**
 * POST /api/widget/session
 * Ouvre (ou reprend) la session visiteur : crée le visiteur si besoin,
 * retourne les réglages publics du bot + la conversation active éventuelle,
 * ainsi que le jeton Realtime qui autorise l'abonnement au canal privé de
 * cette conversation (et d'elle seule).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token } = body;
    if (!isUuid(token)) {
      return NextResponse.json({ error: 'Token visiteur invalide.' }, { status: 400 });
    }

    const limited = await enforce(WIDGET_RULES.session, req, token);
    if (limited) return limited;

    const db = supabaseAdmin();

    // Visiteur (création ou dernier accès).
    // upsert idempotent sur `token` : évite la race condition « duplicate key »
    // quand deux requêtes /session partent en même temps (double montage React en dev,
    // onglets multiples). `ignoreDuplicates: false` met aussi à jour last_seen_at.
    let { data: visitor, error: upsertErr } = await db
      .from('visitors')
      .upsert({ token, last_seen_at: new Date().toISOString() }, { onConflict: 'token' })
      .select('*')
      .single();
    if (upsertErr) console.error('[widget/session] upsert error', upsertErr);
    if (!visitor) {
      // Repli : l'upsert peut ne rien retourner selon la config ; on relit.
      const { data: existing, error: selectErr } = await db.from('visitors').select('*').eq('token', token).maybeSingle();
      if (selectErr) console.error('[widget/session] select error', selectErr);
      visitor = existing;
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
      suggestions: (Array.isArray(s?.suggestions) ? s!.suggestions : []) as unknown as string[]
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
    const conversationId = active?.id ?? randomUUID();
    const realtime = tryMintVisitorToken({ visitorId: visitor.id, conversationId });

    return NextResponse.json({
      visitorId: visitor.id,
      visitorName: visitor.display_name,
      settings,
      conversation: active,
      messages,
      feedback,
      conversationId,
      realtimeToken: realtime?.token ?? null
    });
  } catch (err: any) {
    console.error('[widget/session]', err);
    return NextResponse.json({ error: 'Impossible de charger la session.' }, { status: 500 });
  }
}
