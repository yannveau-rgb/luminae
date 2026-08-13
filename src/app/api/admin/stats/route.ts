import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

const ALLOWED_DAYS = [7, 30, 90] as const;

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

/** GET /api/admin/stats?days=7|30|90 — volumes, répartition bot/escaladées, feedback. */
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

    const [{ data: convos, error: convErr }, { data: prevConvos, error: prevErr }, { data: feedback, error: fbErr }] =
      await Promise.all([
        db
          .from('conversations')
          .select('id, created_at, escalated_at, resolved_at')
          .gte('created_at', from.toISOString()),
        db
          .from('conversations')
          .select('id, escalated_at')
          .gte('created_at', prevFrom.toISOString())
          .lt('created_at', from.toISOString()),
        db.from('message_feedback').select('value').gte('created_at', from.toISOString())
      ]);
    if (convErr) throw new Error(convErr.message);
    if (prevErr) throw new Error(prevErr.message);
    if (fbErr) throw new Error(fbErr.message);

    const rows = convos ?? [];
    const escalated = rows.filter((c) => c.escalated_at).length;
    const botOnly = rows.length - escalated;
    const resolved = rows.filter((c) => c.resolved_at).length;
    const feedbackUp = (feedback ?? []).filter((f) => f.value === 'up').length;
    const feedbackDown = (feedback ?? []).filter((f) => f.value === 'down').length;

    const prevRows = prevConvos ?? [];
    const prevEscalated = prevRows.filter((c) => c.escalated_at).length;

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
      daily
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[admin/stats]', err);
    return NextResponse.json({ error: 'Impossible de charger les statistiques.' }, { status: 500 });
  }
}
