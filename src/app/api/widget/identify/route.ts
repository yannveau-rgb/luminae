import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { broadcast } from '@/lib/broadcast';
import { enforce, WIDGET_RULES } from '@/lib/rate-limit';
import { isUuid } from '@/lib/utils';

/**
 * POST /api/widget/identify
 * Enregistre le prénom que le visiteur veut bien donner.
 *
 * `visitors.display_name` n'était écrit par aucune route : la boîte de réception
 * affichait N fois « Visiteur » avec le même avatar, la recherche était
 * impossible, et la variable {{contact}} des réponses rapides se résolvait
 * toujours en « Visiteur » — donc des messages impersonnels envoyés à des
 * candidats (constat U-03).
 *
 * Volontairement limité au prénom : pas d'e-mail, qui demanderait une colonne
 * supplémentaire et relève de la question de conservation des données (S-11).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, name } = body as { token?: string; name?: string };
    if (!isUuid(token)) {
      return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
    }

    const limited = await enforce(WIDGET_RULES.identify, req, token);
    if (limited) return limited;

    // Caractères de contrôle retirés : ce nom est affiché aux agents et injecté
    // dans les réponses prédéfinies.
    let clean = '';
    for (const ch of (name ?? '').toString()) {
      const code = ch.codePointAt(0) ?? 0;
      if (code >= 32 && code !== 127) clean += ch;
    }
    clean = clean.trim().slice(0, 60);
    if (clean.length < 1) {
      return NextResponse.json({ error: 'Indiquez un prénom.' }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data: visitor, error } = await db
      .from('visitors')
      .update({ display_name: clean })
      .eq('token', token)
      .select('id, display_name')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!visitor) {
      return NextResponse.json({ error: 'Visiteur introuvable.' }, { status: 404 });
    }

    // La boîte de réception affiche le nom : elle doit se rafraîchir sans
    // attendre le message suivant.
    await broadcast('inbox:all', 'inbox:update', { visitor_id: visitor.id });

    return NextResponse.json({ visitorName: visitor.display_name });
  } catch (err) {
    console.error('[widget/identify]', err);
    return NextResponse.json({ error: 'Le prénom n’a pas pu être enregistré.' }, { status: 500 });
  }
}
