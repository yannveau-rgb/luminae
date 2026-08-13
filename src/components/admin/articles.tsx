'use client';

/** Base de connaissances : création, édition, indexation RAG des articles. */

import { useCallback, useEffect, useState } from 'react';
import { Card, Field, FormNotice, SaveButton, SectionHeader, inputCls } from './parts';
import { cn, timeAgo } from '@/lib/utils';

interface ArticleRow {
  id: string;
  title: string;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  indexed: boolean;
}

interface FormState {
  id: string | null;
  title: string;
  category: string;
  tags: string;
  content: string;
}

const EMPTY: FormState = { id: null, title: '', category: '', tags: '', content: '' };

export function ArticlesPanel() {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error' | 'warn'; text: string } | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);

  const unindexedCount = articles.filter((a) => !a.indexed).length;

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/articles', { cache: 'no-store' });
    if (res.ok) {
      const j = await res.json();
      setArticles(j.articles ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function startEdit(id: string) {
    setBusy(true);
    const res = await fetch(`/api/admin/articles/${id}`, { cache: 'no-store' });
    if (res.ok) {
      const j = await res.json();
      const a = j.article;
      setForm({ id: a.id, title: a.title, category: a.category ?? '', tags: (a.tags ?? []).join(', '), content: a.content });
      setNotice(null);
    } else {
      setNotice({ kind: 'error', text: 'Impossible de charger l’article.' });
    }
    setBusy(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setNotice(null);
    const payload = {
      title: form.title,
      category: form.category,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      content: form.content
    };
    const res = await fetch(form.id ? `/api/admin/articles/${form.id}` : '/api/admin/articles', {
      method: form.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setForm(null);
      if (j.indexError) {
        setNotice({ kind: 'warn', text: 'Article enregistré mais non indexé (Mistral indisponible). Réenregistrez-le plus tard.' });
      } else {
        setNotice({ kind: 'ok', text: 'Article enregistré et indexé pour le RAG.' });
      }
      load();
    } else {
      setNotice({ kind: 'error', text: j.error ?? 'L’enregistrement a échoué.' });
    }
    setBusy(false);
  }

  async function reindex() {
    setBusy(true);
    setNotice({ kind: 'ok', text: 'Indexation en cours… (embeddings Mistral)' });
    const res = await fetch('/api/admin/articles/reindex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      if (j.indexed === 0 && j.total === 0) {
        setNotice({ kind: 'ok', text: 'Tous les articles sont déjà indexés.' });
      } else if (j.failed > 0) {
        setNotice({ kind: 'warn', text: `${j.indexed} indexé(s), ${j.failed} en échec (Mistral). Réessayez plus tard.` });
      } else {
        setNotice({ kind: 'ok', text: `${j.indexed} article(s) indexé(s) pour le RAG.` });
      }
      load();
    } else {
      setNotice({ kind: 'error', text: j.error ?? 'La réindexation a échoué.' });
    }
    setBusy(false);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/articles/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setArticles((list) => list.filter((a) => a.id !== id));
      setNotice({ kind: 'ok', text: 'Article supprimé.' });
    } else {
      setNotice({ kind: 'error', text: 'La suppression a échoué.' });
    }
  }

  // Vue formulaire (création / édition).
  if (form) {
    return (
      <form onSubmit={save}>
        <SectionHeader
          title={form.id ? 'Modifier l’article' : 'Nouvel article'}
          description="Le contenu alimente le RAG : rédigez des réponses claires et autonomes."
        />
        <Card>
          <div className="space-y-4">
            <Field label="Titre">
              <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Catégorie">
                <input
                  className={inputCls}
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Tarifs, Livraison…"
                />
              </Field>
              <Field label="Tags" hint="Séparés par des virgules (contexte OS/appareil…).">
                <input
                  className={inputCls}
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="windows, livraison"
                />
              </Field>
            </div>
            <Field label="Contenu">
              <textarea
                className={inputCls}
                rows={10}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                required
              />
            </Field>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <SaveButton busy={busy} label={form.id ? 'Mettre à jour' : 'Créer l’article'} />
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-xl border border-mist-300 px-5 py-2.5 text-sm font-medium text-ink-600 transition hover:bg-mist"
            >
              Annuler
            </button>
          </div>
        </Card>
      </form>
    );
  }

  // Vue liste.
  return (
    <div>
      <SectionHeader
        title="Base de connaissances"
        description="Les articles sont convertis en vecteurs (Mistral Embeddings) pour la recherche sémantique du bot."
      />
      <FormNotice kind={notice?.kind ?? 'ok'} text={notice?.text ?? null} />
      <div className="mt-3 mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-500">
          {loading
            ? 'Chargement…'
            : `${articles.length} article${articles.length > 1 ? 's' : ''}` +
              (unindexedCount > 0 ? ` · ${unindexedCount} non indexé${unindexedCount > 1 ? 's' : ''}` : '')}
        </p>
        <div className="flex items-center gap-2">
          {unindexedCount > 0 && (
            <button
              onClick={reindex}
              disabled={busy}
              className="rounded-xl border border-lagoon-200 bg-white px-4 py-2 text-sm font-medium text-lagoon-700 transition hover:bg-lagoon-50 disabled:opacity-50"
            >
              Régénérer les index
            </button>
          )}
          <button
            onClick={() => {
              setForm(EMPTY);
              setNotice(null);
            }}
            className="rounded-xl bg-lagoon-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-lagoon-700"
          >
            + Nouvel article
          </button>
        </div>
      </div>

      {!loading && articles.length === 0 && (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-ink-400 shadow-panel">
          Aucun article pour l’instant — le bot répondra avec son message de repli.
        </p>
      )}

      <ul className="space-y-2">
        {articles.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-panel">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold">{a.title}</p>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                    a.indexed ? 'bg-lagoon-100 text-lagoon-700' : 'bg-coral-50 text-coral-600'
                  )}
                >
                  {a.indexed ? 'Indexé' : 'Non indexé'}
                </span>
                {a.category && (
                  <span className="rounded-full bg-mist px-2 py-0.5 text-[11px] text-ink-500">{a.category}</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-ink-400">Modifié {timeAgo(a.updated_at)}</p>
            </div>
            <button
              onClick={() => startEdit(a.id)}
              disabled={busy}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-lagoon-700 transition hover:bg-lagoon-50"
            >
              Modifier
            </button>
            <button
              onClick={() => remove(a.id)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-ink-500 transition hover:bg-coral-50 hover:text-coral-600"
            >
              Supprimer
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}