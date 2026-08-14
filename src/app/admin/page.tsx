import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AuthError, requireAgent } from '@/lib/auth';
import { InboxShell } from '@/components/inbox/shell';
import { AccessDenied } from '@/components/access-denied';

export const dynamic = 'force-dynamic';

/** Back-office — Hub unifié réservé aux administrateurs. */
export default async function AdminPage() {
  let agent;
  try {
    agent = await requireAgent('admin');
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.code === 'no_session') redirect('/login');
      if (err.code === 'not_admin') redirect('/inbox');
      return <AccessDenied message={err.message} />;
    }
    throw err;
  }
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-mist text-sm text-ink-400">Chargement…</div>}>
      <InboxShell agent={agent} selectedId={null} initialView="stats" />
    </Suspense>
  );
}
