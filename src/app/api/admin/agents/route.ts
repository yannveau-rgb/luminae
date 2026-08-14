import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/supabase/database.types';

type AgentUpdate = Database['public']['Tables']['agents']['Update'];

/** GET /api/admin/agents — équipe (admin uniquement). */
export async function GET() {
  try {
    await requireAgent('admin');
    const { data: agents } = await supabaseAdmin()
      .from('agents')
      .select('id, email, full_name, role, avatar_url, silent_mode, notification_prefs, created_at')
      .order('created_at', { ascending: true });
    return NextResponse.json({ agents: agents ?? [] });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Impossible de charger l’équipe.' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/agents — édition d'un membre : nom, mode silencieux,
 * préférences de notification, rôle.
 */
export async function PATCH(req: Request) {
  try {
    const admin = await requireAgent('admin');
    const body = await req.json().catch(() => ({}));
    const { id, full_name, silent_mode, notification_prefs, role } = body as {
      id?: string;
      full_name?: string;
      silent_mode?: boolean;
      notification_prefs?: Record<string, boolean>;
      role?: string;
    };
    if (!id) return NextResponse.json({ error: 'Agent manquant.' }, { status: 400 });

    const patch: AgentUpdate = {};
    if (typeof full_name === 'string') patch.full_name = full_name.trim().slice(0, 80) || null;
    if (typeof silent_mode === 'boolean') patch.silent_mode = silent_mode;
    if (notification_prefs && typeof notification_prefs === 'object') {
      const prefs: Record<string, boolean> = {};
      for (const key of ['assigned', 'new_message', 'mention']) {
        prefs[key] = notification_prefs[key] !== false;
      }
      patch.notification_prefs = prefs as unknown as Json;
    }
    if (role === 'admin' || role === 'agent') {
      if (id === admin.id && role !== 'admin') {
        return NextResponse.json({ error: 'Vous ne pouvez pas vous retirer le rôle admin.' }, { status: 400 });
      }
      patch.role = role;
    }

    const { data: agent, error } = await supabaseAdmin()
      .from('agents')
      .update(patch)
      .eq('id', id)
      .select('id, email, full_name, role, avatar_url, silent_mode, notification_prefs, created_at')
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ agent });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[admin/agents]', err);
    return NextResponse.json({ error: 'La mise à jour a échoué.' }, { status: 500 });
  }
}