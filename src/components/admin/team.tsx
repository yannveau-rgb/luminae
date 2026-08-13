'use client';

/** Gestion de l'équipe : rôles, mode silencieux, préférences de notification. */

import { useCallback, useEffect, useState } from 'react';
import type { Agent } from '@/lib/types';
import { Card, FormNotice, SectionHeader, inputCls } from './parts';
import { cn } from '@/lib/utils';

export function TeamPanel({ selfId }: { selfId: string }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/agents', { cache: 'no-store' });
    if (res.ok) {
      const j = await res.json();
      setAgents(j.agents ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(id: string, changes: Record<string, unknown>, okText: string) {
    setNotice(null);
    const res = await fetch('/api/admin/agents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...changes })
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setAgents((list) => list.map((a) => (a.id === id ? { ...a, ...j.agent } : a)));
      setNotice({ kind: 'ok', text: okText });
    } else {
      setNotice({ kind: 'error', text: j.error ?? 'La mise à jour a échoué.' });
    }
  }

  if (loading) return <p className="text-sm text-ink-400">Chargement…</p>;

  return (
    <div>
      <SectionHeader
        title="Équipe"
        description="Rôles, disponibilité et notifications des membres. Les comptes de connexion se créent dans Supabase Auth."
      />
      <FormNotice kind={notice?.kind ?? 'ok'} text={notice?.text ?? null} />
      <div className="mt-3 space-y-3">
        {agents.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {a.full_name ?? a.email}
                  {a.id === selfId && <span className="ml-2 text-xs font-normal text-ink-400">(vous)</span>}
                </p>
                <p className="truncate text-xs text-ink-500">{a.email}</p>
              </div>
              <select
                value={a.role}
                onChange={(e) => patch(a.id, { role: e.target.value }, 'Rôle mis à jour.')}
                className="rounded-lg border border-mist-300 px-2.5 py-1.5 text-xs"
                disabled={a.id === selfId}
                title="Rôle"
              >
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-ink-600" title="Ne reçoit plus de notifications">
                <input
                  type="checkbox"
                  checked={a.silent_mode}
                  onChange={(e) => patch(a.id, { silent_mode: e.target.checked }, 'Mode silencieux mis à jour.')}
                  className="h-4 w-4 accent-lagoon-600"
                />
                Mode silencieux
              </label>
            </div>

            <div className="mt-3 grid gap-3 border-t border-mist-300/60 pt-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-ink-600">
                Nom affiché
                <input
                  className={cn(inputCls, 'mt-1')}
                  defaultValue={a.full_name ?? ''}
                  placeholder="Prénom Nom"
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value !== (a.full_name ?? '')) patch(a.id, { full_name: value }, 'Nom mis à jour.');
                  }}
                />
              </label>
              <div className="text-xs font-medium text-ink-600">
                Notifications
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(
                    [
                      ['assigned', 'Assignations'],
                      ['new_message', 'Nouveaux messages'],
                      ['mention', 'Mentions']
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-1.5 rounded-full border border-mist-300 px-2.5 py-1 font-normal"
                    >
                      <input
                        type="checkbox"
                        checked={a.notification_prefs[key] !== false}
                        onChange={(e) =>
                          patch(
                            a.id,
                            { notification_prefs: { ...a.notification_prefs, [key]: e.target.checked } },
                            'Préférences enregistrées.'
                          )
                        }
                        className="h-3.5 w-3.5 accent-lagoon-600"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}