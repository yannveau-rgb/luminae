import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** DELETE /api/admin/absences/[id] — supprimer une absence. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAgent('admin');
    const { error } = await supabaseAdmin().from('agent_absences').delete().eq('id', params.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'La suppression a échoué.' }, { status: 500 });
  }
}