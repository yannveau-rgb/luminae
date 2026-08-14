import { Suspense } from 'react';
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
      if (err.code === 'no_session') redirect('/login');
      return <AccessDenied message={err.message} />;
    }
    throw err;
  }
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-mist text-sm text-ink-400">Chargement…</div>}>
      <InboxShell agent={agent} selectedId={null} />
    </Suspense>
  );
}
