'use client';

/**
 * Gestion des réponses prédéfinies : bibliothèque insérable via « / » dans le
 * composeur. Un agent gère ses réponses personnelles ; un admin peut aussi
 * créer/éditer/supprimer les réponses partagées (visibles par toute l'équipe).
 * Utilisé en modale depuis l'inbox et en page pleine depuis l'admin.
 */

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Agent, CannedResponse } from '@/lib/types';

interface FormState {
  id: string | null;
  title: string;
  shortcode: string;
  folder: string;
  content: string;
  visibility: 'personal' | 'shared';
}

const EMPTY = (isAdmin: boolean): FormState => ({
  id: null,
  title: '',
  shortcode: '',
  folder: 'Général',
  content: '',
  visibility: isAdmin ? 'shared' : 'personal'
});

export function CannedPanel({
  agent,
  variant = 'inline',
  onClose
}: {
  agent: Agent;
  variant?: 'inline' | 'modal';
  onClose?: () => void;
}) {
  const isAdmin = agent.role === 'admin';
  const [items, setItems] = useState<CannedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/agent/canned', { cache: 'no-store' });
    if (res.ok) {
      const j = await res.json();
      setItems(j.canned ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function canEdit(c: CannedResponse): boolean {
    return c.visibility === 'shared' ? isAdmin : c.agent_id === agent.id;
  }

  function startEdit(c: CannedResponse) {
    setForm({
      id: c.id,
      title: c.title,
      shortcode: c.shortcode,
      folder: c.folder,
      content: c.content,
      visibility: c.visibility
    });
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    const payload = {
      title: form.title,
      shortcode: form.shortcode,
      folder: form.folder,
      content: form.content,
      visibility: form.visibility
    };
    const res = await fetch(form.id ? `/api/agent/canned/${form.id}` : '/api/agent/canned', {
      method: form.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setForm(null);
      load();
    } else {
      setError(j.error ?? 'L’enregistrement a échoué.');
    }
    setBusy(false);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/agent/canned/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setItems((list) => list.filter((c) => c.id !== id));
    } else {
      setError('La suppression a échoué.');
    }
  }

  const grouped = items.reduce<Record<string, CannedResponse[]>>((acc, c) => {
    (acc[c.folder] ??= []).push(c);
    return acc;
  }, {});

  const body = (
    <div>
      {!form ? (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-ink-500">
              {loading ? 'Chargement…' : `${items.length} réponse${items.length > 1 ? 's' : ''}`}
            </p>
            <button
              onClick={() => setForm(EMPTY(isAdmin))}
              className="rounded-xl bg-lagoon-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-lagoon-700"
            >
              + Nouvelle réponse
            </button>
          </div>
          {error && <p className="mb-3 rounded-lg bg-coral-50 px-3 py-2 text-xs text-coral-600">{error}</p>}

          {!loading && items.length === 0 && (
            <p className="rounded-2xl bg-white p-6 text-center text-sm text-ink-400 shadow-panel">
              Aucune réponse prédéfinie. Créez-en une pour l’insérer avec « / » dans le composeur.
            </p>
          )}

          <div className="space-y-5">
            {Object.entries(grouped).map(([folder, list]) => (
              <div key={folder}>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{folder}</h4>
                <ul className="space-y-1.5">
                  {list.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 rounded-xl bg-white px-3.5 py-2.5 shadow-panel">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-lagoon-50 px-1.5 py-0.5 font-mono text-[11px] text-lagoon-700">
                            /{c.shortcode}
                          </span>
                          <p className="truncate text-sm font-medium">{c.title}</p>
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                              c.visibility === 'shared' ? 'bg-aurora-100 text-lagoon-700' : 'bg-mist text-ink-500'
                            )}
                          >
                            {c.visibility === 'shared' ? 'Partagée' : 'Personnelle'}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-ink-400">{c.content}</p>
                      </div>
                      {canEdit(c) && (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => startEdit(c)}
                            className="rounded-full px-2.5 py-1 text-xs font-medium text-lagoon-700 transition hover:bg-lagoon-50"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => remove(c.id)}
                            className="rounded-full px-2.5 py-1 text-xs font-medium text-ink-500 transition hover:bg-coral-50 hover:text-coral-600"
                          >
                            Supprimer
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      ) : (
        <form onSubmit={save}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600">Titre</span>
                <input
                  className="w-full rounded-xl border border-mist-300 px-3.5 py-2.5 text-sm outline-none focus:border-lagoon-400"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600">Raccourci (après « / »)</span>
                <input
                  className="w-full rounded-xl border border-mist-300 px-3.5 py-2.5 text-sm font-mono outline-none focus:border-lagoon-400"
                  value={form.shortcode}
                  onChange={(e) => setForm({ ...form, shortcode: e.target.value })}
                  placeholder="bienvenue"
                  required
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600">Dossier</span>
                <input
                  className="w-full rounded-xl border border-mist-300 px-3.5 py-2.5 text-sm outline-none focus:border-lagoon-400"
                  value={form.folder}
                  onChange={(e) => setForm({ ...form, folder: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600">Visibilité</span>
                <select
                  className="w-full rounded-xl border border-mist-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-lagoon-400"
                  value={form.visibility}
                  onChange={(e) => setForm({ ...form, visibility: e.target.value as 'personal' | 'shared' })}
                >
                  <option value="personal">Personnelle (moi uniquement)</option>
                  {isAdmin && <option value="shared">Partagée (toute l’équipe)</option>}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-600">
                Contenu — variables : <code className="rounded bg-mist px-1">{'{{contact}}'}</code>{' '}
                <code className="rounded bg-mist px-1">{'{{agent}}'}</code>
              </span>
              <textarea
                rows={5}
                className="w-full resize-y rounded-xl border border-mist-300 px-3.5 py-2.5 text-sm outline-none focus:border-lagoon-400"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                required
              />
            </label>
          </div>
          {error && <p className="mt-3 rounded-lg bg-coral-50 px-3 py-2 text-xs text-coral-600">{error}</p>}
          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-lagoon-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-lagoon-700 disabled:opacity-50"
            >
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-xl border border-mist-300 px-5 py-2.5 text-sm font-medium text-ink-600 transition hover:bg-mist"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );

  if (variant === 'inline') {
    return (
      <div>
        <h3 className="mb-1 font-display text-lg font-semibold">Réponses rapides</h3>
        <p className="mb-4 text-sm text-ink-500">
          Insérables dans le composeur avec « / » suivi du raccourci. Les réponses partagées sont visibles par toute
          l’équipe.
        </p>
        {body}
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="canned-modal-title"
      className="fixed inset-0 z-50 flex items-start justify-end bg-ink/40 p-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose?.();
      }}
    >
      <div className="flex h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-mist shadow-panel">
        <div className="flex items-center justify-between border-b border-mist-300 bg-white px-5 py-4">
          <h3 id="canned-modal-title" className="font-display text-base font-semibold">Réponses rapides</h3>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1.5 text-ink-400 transition hover:bg-mist hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{body}</div>
      </div>
    </div>
  );
}
