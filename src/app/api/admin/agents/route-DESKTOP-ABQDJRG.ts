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

/** POST /api/admin/agents — création d'un membre (agent ou admin). */
export async function POST(req: Request) {
  try {
    await requireAgent('admin');
    const body = await req.json().catch(() => ({}));
    const { email, password, full_name, role } = body as {
      email?: string;
      password?: string;
      full_name?: string;
      role?: string;
    };

    const cleanEmail = email?.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json({ error: 'Adresse e-mail invalide.' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, { status: 400 });
    }
    const cleanRole = role === 'admin' ? 'admin' : 'agent';
    const cleanName = full_name?.trim().slice(0, 80) || null;

    const adminClient = supabaseAdmin();
    let authUserId: string | null = null;

    const { data: createdAuth, error: createAuthErr } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: cleanName }
    });

    if (createAuthErr) {
      // Si le compte auth existe déjà, on récupère son identifiant et on met à jour son mot de passe
      const { data: userList } = await adminClient.auth.admin.listUsers();
      const existing = userList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
      if (existing) {
        authUserId = existing.id;
        await adminClient.auth.admin.updateUserById(existing.id, {
          password,
          email_confirm: true,
          user_metadata: { full_name: cleanName }
        });
      } else {
        return NextResponse.json({ error: createAuthErr.message }, { status: 400 });
      }
    } else {
      authUserId = createdAuth.user.id;
    }

    const { data: agent, error: insertErr } = await adminClient
      .from('agents')
      .insert({
        auth_user_id: authUserId,
        email: cleanEmail,
        full_name: cleanName,
        role: cleanRole
      })
      .select('id, email, full_name, role, avatar_url, silent_mode, notification_prefs, created_at')
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'Un agent avec cette adresse e-mail existe déjà.' }, { status: 409 });
      }
      throw new Error(insertErr.message);
    }

    return NextResponse.json({ agent }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[admin/agents] POST error:', err);
    return NextResponse.json({ error: 'Impossible de créer le membre.' }, { status: 500 });
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
    console.error('[admin/agents] PATCH error:', err);
    return NextResponse.json({ error: 'La mise à jour a échoué.' }, { status: 500 });
  }
}

/** DELETE /api/admin/agents — suppression d'un membre de l'équipe et de son compte. */
export async function DELETE(req: Request) {
  try {
    const admin = await requireAgent('admin');
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const id = searchParams.get('id') || (body as { id?: string }).id;

    if (!id) return NextResponse.json({ error: 'Agent manquant.' }, { status: 400 });

    if (id === admin.id) {
      return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, { status: 400 });
    }

    const adminClient = supabaseAdmin();
    const { data: targetAgent, error: fetchErr } = await adminClient
      .from('agents')
      .select('id, email, role, auth_user_id')
      .eq('id', id)
      .single();

    if (fetchErr || !targetAgent) {
      return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 });
    }

    // Empêcher la suppression du dernier administrateur
    if (targetAgent.role === 'admin') {
      const { count } = await adminClient
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: 'Impossible de supprimer le dernier administrateur de la plateforme.' },
          { status: 400 }
        );
      }
    }

    // 1. Suppression dans public.agents
    const { error: delErr } = await adminClient.from('agents').delete().eq('id', id);
    if (delErr) throw new Error(delErr.message);

    // 2. Suppression dans auth.users si lié
    if (targetAgent.auth_user_id) {
      await adminClient.auth.admin.deleteUser(targetAgent.auth_user_id).catch((e) => {
        console.warn('[admin/agents] suppression auth ignorée ou déjà effectuée:', e);
      });
    }

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[admin/agents] DELETE error:', err);
    return NextResponse.json({ error: 'La suppression a échoué.' }, { status: 500 });
  }
}