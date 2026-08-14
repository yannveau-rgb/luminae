'use client';

/** Gestion de l'équipe : rôles, disponibilité, création et suppression de membres. */

import { useCallback, useEffect, useState } from 'react';
import type { Agent } from '@/lib/types';
import { Card, FormNotice, SectionHeader, inputCls } from './parts';
import { cn } from '@/lib/utils';

function generateSecurePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%&*';
  let pwd = '';
  for (let i = 0; i < 12; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

export function TeamPanel({ selfId }: { selfId: string }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Modale d'ajout
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'agent' | 'admin'>('agent');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Modale de confirmation de suppression
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function handleCreateAgent(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setCreating(true);

    const res = await fetch('/api/admin/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newEmail,
        password: newPassword,
        full_name: newFullName,
        role: newRole
      })
    });

    const j = await res.json().catch(() => ({}));
    setCreating(false);

    if (res.ok && j.agent) {
      setAgents((list) => [...list, j.agent]);
      setNotice({ kind: 'ok', text: `Membre ${j.agent.full_name || j.agent.email} créé avec succès.` });
      setAddModalOpen(false);
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('agent');
    } else {
      setAddError(j.error ?? 'Impossible de créer le membre.');
    }
  }

  async function handleDeleteAgent() {
    if (!agentToDelete) return;
    setDeleteError(null);
    setDeleting(true);

    const res = await fetch(`/api/admin/agents?id=${agentToDelete.id}`, {
      method: 'DELETE'
    });
    const j = await res.json().catch(() => ({}));
    setDeleting(false);

    if (res.ok) {
      setAgents((list) => list.filter((a) => a.id !== agentToDelete.id));
      setNotice({ kind: 'ok', text: `Membre ${agentToDelete.full_name || agentToDelete.email} supprimé.` });
      setAgentToDelete(null);
    } else {
      setDeleteError(j.error ?? 'La suppression a échoué.');
    }
  }

  if (loading) return <p className="text-sm text-ink-400">Chargement…</p>;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          title="Équipe"
          description="Création, rôles, disponibilité et suppression des membres de l'équipe."
        />
        <button
          type="button"
          onClick={() => {
            setAddError(null);
            setNewPassword(generateSecurePassword());
            setAddModalOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-xl bg-lagoon-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-lagoon-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter un membre
        </button>
      </div>

      <FormNotice kind={notice?.kind ?? 'ok'} text={notice?.text ?? null} />

      <div className="mt-3 space-y-3">
        {agents.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">
                    {a.full_name ?? a.email}
                    {a.id === selfId && <span className="ml-2 text-xs font-normal text-ink-400">(vous)</span>}
                  </p>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium',
                      a.role === 'admin' ? 'bg-aurora-100 text-aurora-700' : 'bg-mist-100 text-ink-600'
                    )}
                  >
                    {a.role === 'admin' ? 'Admin' : 'Agent'}
                  </span>
                </div>
                <p className="truncate text-xs text-ink-500">{a.email}</p>
              </div>

              <select
                value={a.role}
                onChange={(e) => patch(a.id, { role: e.target.value }, 'Rôle mis à jour.')}
                className="rounded-lg border border-mist-300 px-2.5 py-1.5 text-xs"
                disabled={a.id === selfId}
                title="Modifier le rôle"
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

              {a.id !== selfId && (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setAgentToDelete(a);
                  }}
                  className="rounded-lg border border-coral-200 px-2.5 py-1.5 text-xs font-medium text-coral-600 transition hover:bg-coral-50 hover:border-coral-300"
                  title="Supprimer ce membre"
                >
                  Supprimer
                </button>
              )}
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

      {/* Modale d'ajout d'un membre */}
      {addModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-member-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !creating) setAddModalOpen(false);
          }}
        >
          <form
            onSubmit={handleCreateAgent}
            className="w-full max-w-md animate-slide-up rounded-2xl bg-white p-6 shadow-panel"
          >
            <div className="flex items-center justify-between">
              <h3 id="add-member-title" className="font-display text-base font-semibold text-ink">
                Ajouter un membre à l&apos;équipe
              </h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                disabled={creating}
                className="text-ink-400 hover:text-ink"
              >
                ✕
              </button>
            </div>

            <p className="mt-1 text-xs text-ink-500">
              Crée le compte d&apos;accès et accorde les permissions d&apos;agent ou d&apos;administrateur.
            </p>

            {addError && <p className="mt-3 rounded-lg bg-coral-50 px-3 py-2 text-xs text-coral-600">{addError}</p>}

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600">Nom complet</span>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Ex. Sophie Martin"
                  className={inputCls}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600">Adresse e-mail</span>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="sophie@exemple.fr"
                  className={inputCls}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600">Rôle</span>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'agent' | 'admin')}
                  className={inputCls}
                >
                  <option value="agent">Agent (gestion des conversations, réponses)</option>
                  <option value="admin">Administrateur (accès complet + paramètres et équipe)</option>
                </select>
              </label>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-600">Mot de passe temporaire</span>
                  <button
                    type="button"
                    onClick={() => setNewPassword(generateSecurePassword())}
                    className="text-xs text-lagoon-600 hover:underline"
                  >
                    Générer
                  </button>
                </div>
                <input
                  type="text"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputCls}
                  placeholder="Au moins 8 caractères"
                />
                <span className="mt-1 block text-[11px] text-ink-400">
                  Transmettez ce mot de passe à l&apos;utilisateur. Il pourra le modifier à tout moment.
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-mist-300/60 pt-4">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                disabled={creating}
                className="rounded-xl border border-mist-300 px-4 py-2 text-xs font-semibold text-ink hover:bg-mist-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={creating}
                className="rounded-xl bg-lagoon-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-lagoon-700 disabled:opacity-50"
              >
                {creating ? 'Création…' : 'Créer le membre'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modale de confirmation de suppression */}
      {agentToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-agent-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !deleting) setAgentToDelete(null);
          }}
        >
          <div className="w-full max-w-sm animate-slide-up rounded-2xl bg-white p-6 shadow-panel">
            <h3 id="delete-agent-title" className="font-display text-base font-semibold text-coral-600">
              Supprimer ce membre ?
            </h3>
            <p className="mt-2 text-xs text-ink-600">
              Êtes-vous sûr de vouloir supprimer définitivement{' '}
              <strong>{agentToDelete.full_name || agentToDelete.email}</strong> ({agentToDelete.email}) ?
            </p>
            <p className="mt-1 text-[11px] text-ink-400">
              Son accès à la plateforme et son compte d&apos;authentification seront immédiatement révoqués. Les
              conversations passées restent conservées.
            </p>

            {deleteError && (
              <p className="mt-3 rounded-lg bg-coral-50 px-3 py-2 text-xs text-coral-600">{deleteError}</p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setAgentToDelete(null)}
                disabled={deleting}
                className="rounded-xl border border-mist-300 px-4 py-2 text-xs font-semibold text-ink hover:bg-mist-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteAgent}
                disabled={deleting}
                className="rounded-xl bg-coral-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-coral-700 disabled:opacity-50"
              >
                {deleting ? 'Suppression…' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}