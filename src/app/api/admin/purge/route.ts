import { NextResponse } from 'next/server';
import { AuthError, requireAgent } from '@/lib/auth';
import { ORPHAN_VISITOR_MONTHS, RETENTION_MONTHS, purgeExpired } from '@/lib/retention';

// La purge parcourt le stockage puis la base : lui laisser du temps.
export const maxDuration = 300;

/**
 * POST /api/admin/purge
 * Applique la politique de conservation (constat S-11).
 *
 * Deux appelants possibles :
 *  - un administrateur connecté, depuis le back-office ;
 *  - une tâche planifiée, qui présente `Authorization: Bearer $CRON_SECRET`.
 *
 * Le second mode n'existe que si CRON_SECRET est défini. Sans cette variable,
 * seul un admin peut déclencher la purge — on ne veut pas d'un endpoint
 * destructeur ouvert par défaut.
 */
async function autorise(req: Request): Promise<'admin' | 'cron' | null> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const entete = req.headers.get('authorization') ?? '';
    // Comparaison de longueur constante : évite de distinguer un secret
    // presque juste d'un secret faux par le temps de réponse.
    const fourni = entete.startsWith('Bearer ') ? entete.slice(7) : '';
    if (fourni.length === secret.length && timingSafeEqual(fourni, secret)) return 'cron';
  }
  try {
    await requireAgent('admin');
    return 'admin';
  } catch {
    return null;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * GET — réservé aux tâches planifiées Vercel, qui appellent en GET et joignent
 * `Authorization: Bearer $CRON_SECRET` automatiquement. Refusé à un admin
 * connecté : une purge est destructrice, elle ne doit pas pouvoir partir d'une
 * simple navigation ni d'un préchargement de lien.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const entete = req.headers.get('authorization') ?? '';
  const fourni = entete.startsWith('Bearer ') ? entete.slice(7) : '';
  if (!secret || !timingSafeEqual(fourni, secret)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }
  const rapport = await purgeExpired();
  console.log(
    `[admin/purge] tâche planifiée — ${rapport.conversations} conversation(s), ` +
      `${rapport.visiteurs} visiteur(s), ${rapport.fichiers} fichier(s)`
  );
  return NextResponse.json(rapport);
}

export async function POST(req: Request) {
  try {
    const qui = await autorise(req);
    if (!qui) {
      return NextResponse.json({ error: 'Réservé aux administrateurs.' }, { status: 403 });
    }

    const rapport = await purgeExpired();
    console.log(
      `[admin/purge] déclenchée par ${qui} — ${rapport.conversations} conversation(s), ` +
        `${rapport.visiteurs} visiteur(s), ${rapport.fichiers} fichier(s)`
    );

    return NextResponse.json({
      ...rapport,
      politique: {
        conversations_resolues_mois: RETENTION_MONTHS,
        visiteurs_sans_conversation_mois: ORPHAN_VISITOR_MONTHS
      }
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[admin/purge]', err);
    return NextResponse.json({ error: 'La purge a échoué.' }, { status: 500 });
  }
}
