import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { broadcast } from '@/lib/broadcast';
import { runBotPipeline } from '@/lib/bot-engine';
import { notifyAgents } from '@/lib/notify';
import { enforce, WIDGET_RULES } from '@/lib/rate-limit';
import { tryMintVisitorToken } from '@/lib/visitor-token';
import { isUuid } from '@/lib/utils';
import type { Database } from '@/lib/supabase/database.types';
import type { VisitorContext } from '@/lib/types';

type ConvRow = Database['public']['Tables']['conversations']['Row'];

export const maxDuration = 60;

/**
 * POST /api/widget/messages
 * Message du visiteur : crée la conversation si besoin, insère le message,
 * puis lance le moteur bot (statut « bot ») ou notifie les agents.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, conversationId, content, context } = body as {
      token?: string;
      conversationId?: string;
      content?: string;
      context?: VisitorContext;
    };

    const text = (content ?? '').toString().trim().slice(0, 2000);
    if (!isUuid(token) || !text) {
      return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
    }

    // Quota AVANT tout travail : cette route déclenche un embedding puis une
    // complétion Mistral. C'est le point le plus coûteux de la surface publique.
    const limited = await enforce(WIDGET_RULES.message, req, token);
    if (limited) return limited;

    const db = supabaseAdmin();
    // upsert idempotent : pas de « duplicate key » si le visiteur arrive en parallèle.
    let { data: visitor } = await db
      .from('visitors')
      .upsert({ token, last_seen_at: new Date().toISOString() }, { onConflict: 'token' })
      .select('*')
      .single();
    if (!visitor) {
      const { data: existing } = await db.from('visitors').select('*').eq('token', token).maybeSingle();
      visitor = existing;
    }
    if (!visitor) return NextResponse.json({ error: 'Visiteur introuvable.' }, { status: 500 });

    // Résoudre la conversation : existante et non résolue, sinon nouvelle.
    let conv: ConvRow | null = null;
    if (isUuid(conversationId)) {
      const { data } = await db
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('visitor_id', visitor.id)
        .maybeSingle();
      if (data && data.status !== 'resolved') conv = data;
    }
    if (!conv) {
      const base = {
        visitor_id: visitor.id,
        source_url: context?.url?.slice(0, 1000) ?? null,
        os: context?.os ?? null,
        browser: context?.browser ?? null,
        device_type: context?.device_type ?? null
      };
      // Le client peut fournir l'id de la conversation pour s'abonner au canal
      // Realtime AVANT l'envoi (évite de rater la 1re réponse du bot). On l'utilise
      // seulement s'il est libre ; en cas de collision on laisse la base générer l'id.
      const desiredId = isUuid(conversationId) ? conversationId : undefined;
      let created: ConvRow | null = null;
      if (desiredId) {
        const { data } = await db.from('conversations').insert({ id: desiredId, ...base }).select('*').single();
        created = data;
      }
      if (!created) {
        const { data } = await db.from('conversations').insert(base).select('*').single();
        created = data;
      }
      if (!created) return NextResponse.json({ error: 'La conversation n’a pas pu être créée.' }, { status: 500 });
      conv = created;
      await broadcast('inbox:all', 'inbox:update', { conversation_id: conv.id });
    }

    // Insérer le message visiteur.
    const { data: msg, error: msgErr } = await db
      .from('messages')
      .insert({ conversation_id: conv.id, sender: 'visitor', content: text })
      .select('*')
      .single();
    if (msgErr) throw new Error(msgErr.message);

    await broadcast(`conv:${conv.id}`, 'message:new', msg);
    await broadcast(`conv:${conv.id}`, 'conversation:update', { id: conv.id, status: conv.status });

    // Tout message du visiteur rafraîchit la boîte de réception. L'ancienne
    // version ne le faisait que pour les conversations déjà escaladées : le
    // compteur de non-lus (migration 0012) et le dernier message ne bougeaient
    // donc pas en direct pendant la phase bot.
    await broadcast('inbox:all', 'inbox:update', { conversation_id: conv.id });

    if (conv.status === 'bot') {
      // Le moteur bot répond (ou escalade). Réponse et statut arrivent au widget
      // via Realtime (il est déjà abonné grâce à l'id fourni). Une panne du bot ne
      // doit PAS renvoyer 500 : le message visiteur est déjà enregistré et diffusé.
      try {
        await runBotPipeline(conv.id, text);
      } catch (botErr) {
        console.error('[widget/messages] pipeline bot', botErr);
        await broadcast(`conv:${conv.id}`, 'typing', { from: 'bot', on: false });
      }
    } else {
      // Déjà escaladée : notifier l'agent assigné ou toute l'équipe.
      await notifyAgents({
        type: 'new_message',
        title: 'Nouveau message du visiteur',
        body: text.slice(0, 140),
        conversationId: conv.id,
        onlyAgentId: conv.status === 'assigned' ? conv.assigned_agent_id ?? undefined : undefined
      });
    }

    // Statut à jour (l'escalade a pu passer la conversation en « waiting »).
    const { data: fresh } = await db.from('conversations').select('id, status').eq('id', conv.id).single();

    // Jeton Realtime rafraîchi : indispensable si l'id retenu diffère de celui
    // demandé (collision de clé, la base a généré le sien) — sinon le widget
    // resterait abonné à un canal qui ne recevra jamais rien.
    const realtime = tryMintVisitorToken({ visitorId: visitor.id, conversationId: conv.id });

    return NextResponse.json({
      conversationId: conv.id,
      status: fresh?.status ?? conv.status,
      realtimeToken: realtime?.token ?? null
    });
  } catch (err: any) {
    console.error('[widget/messages]', err);
    return NextResponse.json({ error: 'Le message n’a pas pu être envoyé. Réessayez.' }, { status: 500 });
  }
}
