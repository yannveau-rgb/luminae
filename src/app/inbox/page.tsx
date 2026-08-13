import { redirect } from 'next/navigation';
import { AuthError, requireAgent } from '@/lib/auth';
import { InboxShell } from '@/components/inbox/shell';

export const dynamic = 'force-dynamic';

/** Boîte de réception — vue liste sans conversation sélectionnée. */
export default async function InboxPage() {
  let agent;
  try {
    agent = await requireAgent();
  } catch (err) {
    if (err instanceof AuthError) redirect('/login');
    throw err;
  }
  return <InboxShell agent={agent} selectedId={null} />;
}