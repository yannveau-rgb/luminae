import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/supabase/database.types';

type HoursUpdate = Database['public']['Tables']['business_hours']['Update'];

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/admin/business-hours — horaires d'ouverture (singleton). */
export async function GET() {
  try {
    await requireAgent('admin');
    const { data: hours } = await supabaseAdmin().from('business_hours').select('*').eq('id', 1).maybeSingle();
    if (!hours) {
      return NextResponse.json({ error: 'Horaires introuvables — exécutez le seed.' }, { status: 404 });
    }
    return NextResponse.json({ hours });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Impossible de charger les horaires.' }, { status: 500 });
  }
}

/** PUT /api/admin/business-hours — fuseau, créneaux hebdo et jours fériés. */
export async function PUT(req: Request) {
  try {
    await requireAgent('admin');
    const body = await req.json().catch(() => ({}));
    const patch: HoursUpdate = {};

    if (typeof body.timezone === 'string') {
      try {
        new Intl.DateTimeFormat('fr-FR', { timeZone: body.timezone });
        patch.timezone = body.timezone;
      } catch {
        return NextResponse.json({ error: 'Fuseau horaire invalide.' }, { status: 400 });
      }
    }

    if (body.weekly && typeof body.weekly === 'object') {
      const weekly: Record<string, [string, string][]> = {};
      for (const day of DAY_KEYS) {
        const slots = (body.weekly as Record<string, unknown>)[day];
        if (!Array.isArray(slots)) continue;
        const valid: [string, string][] = [];
        for (const slot of slots) {
          const [start, end] = slot as [unknown, unknown];
          if (typeof start === 'string' && typeof end === 'string' && TIME_RE.test(start) && TIME_RE.test(end) && start < end) {
            valid.push([start, end]);
          }
        }
        weekly[day] = valid;
      }
      patch.weekly = weekly as unknown as Json;
    }

    if (Array.isArray(body.holidays)) {
      const holidays = body.holidays
        .filter(
          (h: unknown): h is { date: string; name?: string } =>
            !!h && typeof h === 'object' && typeof (h as { date?: unknown }).date === 'string'
        )
        .filter((h: { date: string; name?: string }) => DATE_RE.test(h.date))
        .map((h: { date: string; name?: string }) => ({ date: h.date, name: (h.name ?? '').toString().slice(0, 60) }));
      patch.holidays = holidays as unknown as Json;
    }

    const { data: hours, error } = await supabaseAdmin()
      .from('business_hours')
      .update(patch)
      .eq('id', 1)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ hours });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[admin/business-hours]', err);
    return NextResponse.json({ error: 'La sauvegarde a échoué.' }, { status: 500 });
  }
}