import { redirect } from 'next/navigation';
import { AuthError, requireAgent } from '@/lib/auth';
import { InboxShell } from '@/components/inbox/shell';
import { ConversationView } from '@/components/inbox/conversation';

export const dynamic = 'force-dynamic';

/** Espace de travail d'une conversation donnée. */
export default async function ConversationPage({ params }: { params: { id: string } }) {
  let agent;
  try {
    agent = await requireAgent();
  } catch (err) {
    if (err instanceof AuthError) redirect('/login');
    throw err;
  }
  return (
    <InboxShell agent={agent} selectedId={params.id}>
      <ConversationView conversationId={params.id} agent={agent} />
    </InboxShell>
  );
}