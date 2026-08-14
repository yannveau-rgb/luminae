import { redirect } from 'next/navigation';
import { AuthError, requireAgent } from '@/lib/auth';
import { InboxShell } from '@/components/inbox/shell';
import { AccessDenied } from '@/components/access-denied';

export const dynamic = 'force-dynamic';

/** Boîte de réception — vue liste sans conversation sélectionnée. */
export default async function InboxPage() {
  let agent;
  try {
    agent = await requireAgent();
  } catch (err) {
    if (err instanceof AuthError) {
      // Pas de session : la page de connexion est la bonne destination.
      if (err.code === 'no_session') redirect('/login');
      // Session valide mais compte hors de l'équipe : surtout ne pas renvoyer
      // vers /login, qui rebondit vers ici dès qu'une session existe.
      return <AccessDenied message={err.message} />;
    }
    throw err;
  }
  return <InboxShell agent={agent} selectedId={null} />;
}
