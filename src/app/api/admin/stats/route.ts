import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { classifyConversationIntent, INTENT_DEFINITIONS } from '@/lib/intent-classifier';

const ALLOWED_DAYS = [7, 30, 90, 365] as const;

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

/** GET /api/admin/stats?days=7|30|90|365 — volumes, répartition bot/escaladées, intentions analysées. */
export async function GET(req: Request) {
  try {
    await requireAgent('admin');
    const db = supabaseAdmin();

    const url = new URL(req.url);
    const daysParam = Number(url.searchParams.get('days'));
    const days = (ALLOWED_DAYS as readonly number[]).includes(daysParam) ? daysParam : 30;

    const now = new Date();
    const from = new Date(now.getTime() - days * 86400000);
    const prevFrom = new Date(from.getTime() - days * 86400000);

    const [
      { data: convos, error: convErr },
      { data: prevConvos, error: prevErr },
      { data: feedback, error: fbErr },
      { data: messages, error: msgErr }
    ] = await Promise.all([
      db
        .from('conversations')
        .select('id, created_at, escalated_at, resolved_at, source_url, status')
        .gte('created_at', from.toISOString()),
      db
        .from('conversations')
        .select('id, escalated_at')
        .gte('created_at', prevFrom.toISOString())
        .lt('created_at', from.toISOString()),
      db.from('message_feedback').select('value, message_id, created_at').gte('created_at', from.toISOString()),
      db
        .from('messages')
        .select('conversation_id, content, sender, created_at')
        .eq('sender', 'visitor')
        .gte('created_at', from.toISOString())
        .order('created_at', { ascending: true })
    ]);

    if (convErr) throw new Error(convErr.message);
    if (prevErr) throw new Error(prevErr.message);
    if (fbErr) throw new Error(fbErr.message);
    if (msgErr) throw new Error(msgErr.message);

    const rows = convos ?? [];
    const escalated = rows.filter((c) => c.escalated_at).length;
    const botOnly = rows.length - escalated;
    const resolved = rows.filter((c) => c.resolved_at).length;
    const feedbackUp = (feedback ?? []).filter((f) => f.value === 'up').length;
    const feedbackDown = (feedback ?? []).filter((f) => f.value === 'down').length;

    const prevRows = prevConvos ?? [];
    const prevEscalated = prevRows.filter((c) => c.escalated_at).length;

    // Premier message visiteur par conversation
    const firstMsgMap = new Map<string, string>();
    for (const m of messages ?? []) {
      if (!firstMsgMap.has(m.conversation_id)) {
        firstMsgMap.set(m.conversation_id, m.content ?? '');
      }
    }

    // Analyse & Classification des Intentions
    const intentCounts = new Map<
      string,
      { count: number; botOnly: number; escalated: number; resolved: number }
    >();

    Object.keys(INTENT_DEFINITIONS).forEach((k) => {
      intentCounts.set(k, { count: 0, botOnly: 0, escalated: 0, resolved: 0 });
    });

    for (const c of rows) {
      const firstMsg = firstMsgMap.get(c.id) ?? '';
      const intent = classifyConversationIntent(firstMsg, c.source_url);
      const cur = intentCounts.get(intent.id) ?? { count: 0, botOnly: 0, escalated: 0, resolved: 0 };
      cur.count += 1;
      if (c.escalated_at) {
        cur.escalated += 1;
      } else {
        cur.botOnly += 1;
      }
      if (c.resolved_at) cur.resolved += 1;
      intentCounts.set(intent.id, cur);
    }

    const totalConvs = rows.length || 1;
    const intentsList = Array.from(intentCounts.entries())
      .map(([id, data]) => {
        const def = INTENT_DEFINITIONS[id] ?? INTENT_DEFINITIONS.general_inquiry;
        const percentage = Math.round((data.count / totalConvs) * 100);
        const botRate = data.count > 0 ? Math.round((data.botOnly / data.count) * 100) : 0;
        return {
          id,
          label: def.label,
          category: def.category,
          icon: def.icon,
          colorClass: def.colorClass,
          badgeClass: def.badgeClass,
          count: data.count,
          percentage,
          botOnlyCount: data.botOnly,
          escalatedCount: data.escalated,
          botResolutionRate: botRate
        };
      })
      .filter((i) => i.count > 0 || rows.length === 0)
      .sort((a, b) => b.count - a.count);

    // Volume quotidien (jours sans conversation inclus, à zéro).
    const daily: { date: string; count: number }[] = [];
    const counts = new Map<string, number>();
    for (const c of rows) counts.set(dayKey(c.created_at), (counts.get(dayKey(c.created_at)) ?? 0) + 1);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = dayKey(d.toISOString());
      daily.push({ date: key, count: counts.get(key) ?? 0 });
    }

    return NextResponse.json({
      range: { days, from: from.toISOString(), to: now.toISOString() },
      totals: {
        conversations: rows.length,
        bot_only: botOnly,
        escalated,
        resolved,
        feedback_up: feedbackUp,
        feedback_down: feedbackDown
      },
      previous: { conversations: prevRows.length, escalated: prevEscalated },
      daily,
      intents: intentsList
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[admin/stats]', err);
    return NextResponse.json({ error: 'Impossible de charger les statistiques.' }, { status: 500 });
  }
}
