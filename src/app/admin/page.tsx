import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AuthError, requireAgent } from '@/lib/auth';
import { AdminShell } from '@/components/admin/shell';
import { AccessDenied } from '@/components/access-denied';

export const dynamic = 'force-dynamic';

/** Back-office — réservé aux administrateurs. */
export default async function AdminPage() {
  let agent;
  try {
    agent = await requireAgent('admin');
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.code === 'no_session') redirect('/login');
      // Agent authentifié mais sans le rôle admin : la boîte de réception lui
      // est ouverte, on l'y renvoie.
      if (err.code === 'not_admin') redirect('/inbox');
      // Compte hors de l'équipe : /inbox refuserait aussi, d'où la boucle.
      return <AccessDenied message={err.message} />;
    }
    throw err;
  }
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-mist text-sm text-ink-400">Chargement…</div>}>
      <AdminShell agent={agent} />
    </Suspense>
  );
}
