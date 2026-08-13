import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** GET /api/admin/absences — liste des absences avec le nom de l'agent. */
export async function GET() {
  try {
    await requireAgent('admin');
    const db = supabaseAdmin();
    const [{ data: absences }, { data: agents }] = await Promise.all([
      db.from('agent_absences').select('*').order('starts_at', { ascending: false }),
      db.from('agents').select('id, full_name, email')
    ]);
    const names = new Map((agents ?? []).map((a) => [a.id, a.full_name ?? a.email]));
    const items = (absences ?? []).map((a) => ({ ...a, agent_name: names.get(a.agent_id) ?? null }));
    return NextResponse.json({ absences: items });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Impossible de charger les absences.' }, { status: 500 });
  }
}

/** POST /api/admin/absences — déclarer une absence. */
export async function POST(req: Request) {
  try {
    const admin = await requireAgent('admin');
    const body = await req.json().catch(() => ({}));
    const { agent_id, starts_at, ends_at, reason } = body as {
      agent_id?: string;
      starts_at?: string;
      ends_at?: string;
      reason?: string;
    };

    if (!agent_id || !starts_at || !ends_at) {
      return NextResponse.json({ error: 'Agent, début et fin sont requis.' }, { status: 400 });
    }
    const start = new Date(starts_at);
    const end = new Date(ends_at);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: 'Les dates sont invalides (la fin doit suivre le début).' }, { status: 400 });
    }
    const db = supabaseAdmin();
    const { data: agent } = await db.from('agents').select('id').eq('id', agent_id).maybeSingle();
    if (!agent) return NextResponse.json({ error: 'Agent introuvable.' }, { status: 404 });

    const { data: absence, error } = await db
      .from('agent_absences')
      .insert({
        agent_id,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        reason: (reason ?? '').toString().trim().slice(0, 200) || null,
        created_by: admin.id
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ absence });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[admin/absences]', err);
    return NextResponse.json({ error: 'L’absence n’a pas pu être enregistrée.' }, { status: 500 });
  }
}