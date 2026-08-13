import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/agent/me
 * Profil de l'agent connecté + liste de l'équipe (pour l'assignation).
 */
export async function GET() {
  try {
    const agent = await requireAgent();
    const db = supabaseAdmin();
    const { data: team } = await db.from('agents').select('id, full_name, role').order('full_name');
    return NextResponse.json({ agent, team: team ?? [] });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[agent/me]', err);
    return NextResponse.json({ error: 'Impossible de charger le profil.' }, { status: 500 });
  }
}