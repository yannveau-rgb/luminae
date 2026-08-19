import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AuthError, requireAgent } from '@/lib/auth';
import { InboxShell } from '@/components/inbox/shell';
import { AccessDenied } from '@/components/access-denied';

export const dynamic = 'force-dynamic';

export default async function AdminPage({
  searchParams
}: {
  searchParams?: { tab?: string; view?: string };
}) {
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

  const initialTab = searchParams?.tab || searchParams?.view || 'stats';

  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-mist text-sm text-ink-400">Chargement…</div>}>
      <InboxShell agent={agent} selectedId={null} initialView={initialTab} />
    </Suspense>
  );
}
