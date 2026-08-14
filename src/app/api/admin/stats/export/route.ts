import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { classifyConversationIntent } from '@/lib/intent-classifier';

export const dynamic = 'force-dynamic';

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""').replace(/\r?\n/g, ' ');
  return `"${str}"`;
}

/** GET /api/admin/stats/export?days=30&format=csv|json — Export de données complet. */
export async function GET(req: Request) {
  try {
    await requireAgent('admin');
    const db = supabaseAdmin();

    const url = new URL(req.url);
    const days = Number(url.searchParams.get('days')) || 30;
    const format = url.searchParams.get('format') === 'json' ? 'json' : 'csv';

    const now = new Date();
    const from = new Date(now.getTime() - days * 86400000);

    const [
      { data: convos, error: convErr },
      { data: messages, error: msgErr },
      { data: feedbacks, error: fbErr }
    ] = await Promise.all([
      db
        .from('conversations')
        .select('id, created_at, escalated_at, resolved_at, source_url, status, visitor_id')
        .gte('created_at', from.toISOString())
        .order('created_at', { ascending: false }),
      db
        .from('messages')
        .select('conversation_id, content, sender, created_at')
        .gte('created_at', from.toISOString())
        .order('created_at', { ascending: true }),
      db.from('message_feedback').select('conversation_id, value').gte('created_at', from.toISOString())
    ]);

    if (convErr) throw new Error(convErr.message);
    if (msgErr) throw new Error(msgErr.message);
    if (fbErr) throw new Error(fbErr.message);

    const firstMsgMap = new Map<string, string>();
    for (const m of messages ?? []) {
      if (m.sender === 'visitor' && !firstMsgMap.has(m.conversation_id)) {
        firstMsgMap.set(m.conversation_id, m.content ?? '');
      }
    }

    const feedbackMap = new Map<string, string>();
    for (const fb of feedbacks ?? []) {
      if (fb.conversation_id) {
        feedbackMap.set(fb.conversation_id, fb.value === 'up' ? 'Positif (👍)' : 'Négatif (👎)');
      }
    }

    const exportRows = (convos ?? []).map((c) => {
      const firstMsg = firstMsgMap.get(c.id) ?? '';
      const intent = classifyConversationIntent(firstMsg, c.source_url);
      const isBotOnly = !c.escalated_at;
      const isResolved = Boolean(c.resolved_at);
      const csat = feedbackMap.get(c.id) ?? 'Non évalué';

      return {
        id: c.id,
        created_at: new Date(c.created_at).toLocaleString('fr-FR'),
        status: c.status,
        intent_label: intent.label,
        intent_category: intent.category,
        bot_only: isBotOnly ? 'Oui' : 'Non',
        escalated: c.escalated_at ? 'Oui' : 'Non',
        resolved: isResolved ? 'Oui' : 'Non',
        csat_rating: csat,
        source_url: c.source_url ?? 'Direct',
        first_message: firstMsg
      };
    });

    const dateStr = now.toISOString().slice(0, 10);

    if (format === 'json') {
      const jsonContent = JSON.stringify(
        {
          platform: 'Luminae 2.0 (Made in France)',
          exported_at: now.toISOString(),
          period_days: days,
          total_records: exportRows.length,
          data: exportRows
        },
        null,
        2
      );

      return new NextResponse(jsonContent, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="luminae-stats-${dateStr}.json"`
        }
      });
    }

    // Format CSV (séparateur point-virgule avec BOM UTF-8 pour Excel)
    const headers = [
      'ID Conversation',
      'Date et Heure',
      'Statut',
      'Intention / Motif de Contact',
      'Catégorie',
      'Géré uniquement par Bot Lumi',
      'Escaladé Conseiller',
      'Résolu',
      'Évaluation CSAT',
      'URL Source',
      'Premier Message Visiteur'
    ];

    const csvLines = [
      headers.join(';'),
      ...exportRows.map((r) =>
        [
          escapeCsvCell(r.id),
          escapeCsvCell(r.created_at),
          escapeCsvCell(r.status),
          escapeCsvCell(r.intent_label),
          escapeCsvCell(r.intent_category),
          escapeCsvCell(r.bot_only),
          escapeCsvCell(r.escalated),
          escapeCsvCell(r.resolved),
          escapeCsvCell(r.csat_rating),
          escapeCsvCell(r.source_url),
          escapeCsvCell(r.first_message)
        ].join(';')
      )
    ];

    const BOM = '\uFEFF';
    const csvContent = BOM + csvLines.join('\r\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="luminae-stats-${dateStr}.csv"`
      }
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[admin/stats/export]', err);
    return NextResponse.json({ error: 'Échec de la génération de l’export.' }, { status: 500 });
  }
}
