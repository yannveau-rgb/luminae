import { redirect } from 'next/navigation';
import { AuthError, requireAgent } from '@/lib/auth';
import { AdminShell } from '@/components/admin/shell';

export const dynamic = 'force-dynamic';

/** Back-office — réservé aux administrateurs. */
export default async function AdminPage() {
  let agent;
  try {
    agent = await requireAgent('admin');
  } catch (err) {
    if (err instanceof AuthError) redirect(err.status === 401 ? '/login' : '/inbox');
    throw err;
  }
  return <AdminShell agent={agent} />;
}