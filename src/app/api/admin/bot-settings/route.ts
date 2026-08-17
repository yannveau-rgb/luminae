import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/supabase/database.types';

type SettingsUpdate = Database['public']['Tables']['bot_settings']['Update'];

/** GET /api/admin/bot-settings — réglages du bot (singleton). */
export async function GET() {
  try {
    await requireAgent('admin');
    const db = supabaseAdmin();
    const { data: settings } = await db.from('bot_settings').select('*').eq('id', 1).maybeSingle();
    if (!settings) {
      return NextResponse.json({ error: 'Réglages introuvables — exécutez le seed.' }, { status: 404 });
    }

    const rawStore = ((settings.suggestions as Record<string, unknown>) ?? {}) as Record<string, unknown>;
    const companyInfo = (rawStore.company_info ?? {}) as Record<string, string>;
    const suggestionsArray = (Array.isArray(settings.suggestions) ? settings.suggestions : rawStore.initial_suggestions ?? []) as string[];

    return NextResponse.json({
      settings: {
        ...settings,
        suggestions: suggestionsArray,
        company_name: companyInfo.company_name ?? (settings as Record<string, unknown>).company_name ?? '',
        company_activity: companyInfo.company_activity ?? (settings as Record<string, unknown>).company_activity ?? '',
        company_description: companyInfo.company_description ?? (settings as Record<string, unknown>).company_description ?? '',
        brand_vibe: companyInfo.brand_vibe ?? (settings as Record<string, unknown>).brand_vibe ?? '',
        custom_instructions: companyInfo.custom_instructions ?? (settings as Record<string, unknown>).custom_instructions ?? ''
      }
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Impossible de charger les réglages.' }, { status: 500 });
  }
}

/** PUT /api/admin/bot-settings — mise à jour validée des réglages. */
export async function PUT(req: Request) {
  try {
    await requireAgent('admin');
    const body = await req.json().catch(() => ({}));
    const db = supabaseAdmin();

    const { data: currentSettings } = await db.from('bot_settings').select('suggestions').eq('id', 1).maybeSingle();
    const currentStore = ((currentSettings?.suggestions as Record<string, unknown>) ?? {}) as Record<string, unknown>;

    const patch: SettingsUpdate = {};
    if (typeof body.bot_name === 'string') patch.bot_name = body.bot_name.trim().slice(0, 60) || 'Assistant';
    for (const key of ['welcome_message', 'fallback_message', 'offline_message'] as const) {
      if (typeof body[key] === 'string') (patch as Record<string, unknown>)[key] = body[key].trim().slice(0, 500);
    }
    if (body.tone === 'formal' || body.tone === 'casual') patch.tone = body.tone;
    if (['concise', 'normal', 'detailed'].includes(body.reply_length)) patch.reply_length = body.reply_length;
    if (typeof body.small_talk_enabled === 'boolean') patch.small_talk_enabled = body.small_talk_enabled;
    if (typeof body.accent_color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.accent_color.trim())) {
      patch.accent_color = body.accent_color.trim();
    }

    const suggestionsArray = Array.isArray(body.suggestions)
      ? body.suggestions
          .filter((s: unknown): s is string => typeof s === 'string')
          .map((s: string) => s.trim().slice(0, 80))
          .filter(Boolean)
          .slice(0, 6)
      : [];

    const companyInfo = {
      company_name: typeof body.company_name === 'string' ? body.company_name.trim().slice(0, 100) : '',
      company_activity: typeof body.company_activity === 'string' ? body.company_activity.trim().slice(0, 150) : '',
      company_description: typeof body.company_description === 'string' ? body.company_description.trim().slice(0, 1000) : '',
      brand_vibe: typeof body.brand_vibe === 'string' ? body.brand_vibe.trim().slice(0, 300) : '',
      custom_instructions: typeof body.custom_instructions === 'string' ? body.custom_instructions.trim().slice(0, 1500) : ''
    };

    const updatedStore = {
      ...currentStore,
      initial_suggestions: suggestionsArray,
      company_info: companyInfo
    };

    patch.suggestions = updatedStore as unknown as Json;
    if (typeof body.rag_threshold === 'number' && body.rag_threshold >= 0 && body.rag_threshold <= 1) {
      patch.rag_threshold = body.rag_threshold;
    }
    if (Number.isInteger(body.rag_top_k) && body.rag_top_k >= 1 && body.rag_top_k <= 10) {
      patch.rag_top_k = body.rag_top_k;
    }
    // Politique de confidentialité, affichée dans le pied du widget. https
    // exigé : un lien en http sur un site client déclencherait un avertissement
    // de contenu mixte, et c'est un lien de conformité — il doit inspirer
    // confiance.
    if (typeof body.privacy_url === 'string') {
      const raw = body.privacy_url.trim();
      if (!raw) {
        patch.privacy_url = null;
      } else {
        let ok = false;
        try {
          ok = new URL(raw).protocol === 'https:';
        } catch {
          ok = false;
        }
        if (!ok) {
          return NextResponse.json(
            { error: 'Le lien de confidentialité doit être une adresse https.' },
            { status: 400 }
          );
        }
        patch.privacy_url = raw;
      }
    }

    // L'avatar est rendu dans une balise <img> servie sur TOUS les sites
    // clients : un URL arbitraire y devient un pixel de traçage à l'échelle du
    // parc. On impose donc https, et on écarte les hôtes internes (constat S-15).
    if (typeof body.avatar_url === 'string') {
      const raw = body.avatar_url.trim();
      if (!raw) {
        patch.avatar_url = null;
      } else {
        let accepted: string | null = null;
        try {
          const parsed = new URL(raw);
          const host = parsed.hostname.toLowerCase();
          const isLocal =
            host === 'localhost' ||
            host === '::1' ||
            /^127\./.test(host) ||
            /^10\./.test(host) ||
            /^192\.168\./.test(host) ||
            /^169\.254\./.test(host) ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(host);
          if (parsed.protocol === 'https:' && !isLocal) accepted = parsed.toString();
        } catch {
          accepted = null;
        }
        if (!accepted) {
          return NextResponse.json(
            { error: 'L’avatar doit être une adresse https publique.' },
            { status: 400 }
          );
        }
        patch.avatar_url = accepted;
      }
    }

    const { data: settings, error } = await supabaseAdmin()
      .from('bot_settings')
      .update(patch)
      .eq('id', 1)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ settings });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[admin/bot-settings]', err);
    return NextResponse.json({ error: 'La sauvegarde a échoué.' }, { status: 500 });
  }
}