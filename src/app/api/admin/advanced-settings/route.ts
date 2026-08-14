import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Json } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

/** GET /api/admin/advanced-settings — Récupère les configurations avancées (routing, triggers, prechat, webhooks, security). */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    return NextResponse.json({ error: error.message ?? 'Accès refusé' }, { status: error.status ?? 403 });
  }

  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section');

  const db = supabaseAdmin();
  const { data: settingsRow } = await db
    .from('bot_settings')
    .select('suggestions')
    .eq('id', 1)
    .maybeSingle();

  const store = ((settingsRow?.suggestions as Record<string, unknown>) ?? {}) as Record<string, unknown>;

  if (section && store[section]) {
    return NextResponse.json({ [section]: store[section] });
  }

  return NextResponse.json({
    routing: store.routing ?? null,
    triggers: store.triggers ?? null,
    prechat: store.prechat ?? null,
    webhooks: store.webhooks ?? null,
    security: store.security ?? null
  });
}

/** PUT /api/admin/advanced-settings — Enregistre une section de configuration avancée. */
export async function PUT(request: Request) {
  try {
    await requireAdmin();
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    return NextResponse.json({ error: error.message ?? 'Accès refusé' }, { status: error.status ?? 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.section || body.data === undefined) {
    return NextResponse.json({ error: 'Section et données requises' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: settingsRow } = await db
    .from('bot_settings')
    .select('suggestions')
    .eq('id', 1)
    .maybeSingle();

  const currentStore = ((settingsRow?.suggestions as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  const updatedStore = {
    ...currentStore,
    [body.section]: body.data
  };

  const { error: updateErr } = await db
    .from('bot_settings')
    .update({
      suggestions: updatedStore as unknown as Json,
      updated_at: new Date().toISOString()
    })
    .eq('id', 1);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, [body.section]: body.data });
}
