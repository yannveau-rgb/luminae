'use client';

/** Base de connaissances : création, édition, indexation RAG et import de documents complets. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, EmptyState, Field, FormNotice, SaveButton, SectionHeader, SkeletonList, inputCls } from './parts';
import { cn, timeAgo } from '@/lib/utils';
import type { ParsedArticle } from '@/lib/knowledge-importer';

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

interface ImportState {
  stage: 'upload' | 'preview' | 'importing';
  fileName: string;
  rawContent: string;
  mode: 'append' | 'replace';
  articles: ParsedArticle[];
}

const EMPTY: FormState = { id: null, title: '', category: '', tags: '', content: '' };

export function ArticlesPanel() {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error' | 'warn'; text: string } | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [importer, setImporter] = useState<ImportState | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const unindexedCount = articles.filter((a) => !a.indexed).length;
  const categories = Array.from(new Set(articles.map((a) => a.category).filter(Boolean)));

  const filteredArticles = articles.filter((a) => {
    if (selectedCat === 'unindexed' && a.indexed) return false;
    if (selectedCat !== 'all' && selectedCat !== 'unindexed' && a.category !== selectedCat) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      (a.category ?? '').toLowerCase().includes(q) ||
      (a.tags ?? []).some((t) => t.toLowerCase().includes(q))
    );
  });

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
        setNotice({ kind: 'ok', text: 'Article enregistré et indexé avec succès.' });
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
        setNotice({ kind: 'ok', text: `${j.indexed} article(s) indexé(s) pour la recherche sémantique.` });
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

  // ── Traitement du fichier importé ──────────────────────────────────────────
  async function processFile(file: File) {
    setBusy(true);
    setNotice(null);
    try {
      const text = await file.text();
      const res = await fetch('/api/admin/articles/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          rawContent: text,
          fileName: file.name
        })
      });
      const j = await res.json();
      if (res.ok && j.articles && j.articles.length > 0) {
        setImporter({
          stage: 'preview',
          fileName: file.name,
          rawContent: text,
          mode: 'append',
          articles: j.articles
        });
      } else {
        setNotice({ kind: 'error', text: j.error ?? 'Impossible d’extraire des articles de ce fichier.' });
      }
    } catch {
      setNotice({ kind: 'error', text: 'Erreur lors de la lecture du fichier.' });
    }
    setBusy(false);
  }

  async function executeImport() {
    if (!importer || importer.articles.length === 0) return;
    setBusy(true);
    setImporter({ ...importer, stage: 'importing' });
    try {
      const res = await fetch('/api/admin/articles/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          mode: importer.mode,
          articles: importer.articles
        })
      });
      const j = await res.json();
      if (res.ok) {
        setNotice({
          kind: 'ok',
          text: `🎉 ${j.count} articles importés avec succès (${j.indexed} indexés pour la recherche sémantique).`
        });
        setImporter(null);
        load();
      } else {
        setNotice({ kind: 'error', text: j.error ?? 'L’importation a échoué.' });
        setImporter({ ...importer, stage: 'preview' });
      }
    } catch {
      setNotice({ kind: 'error', text: 'Erreur réseau lors de l’importation.' });
      setImporter({ ...importer, stage: 'preview' });
    }
    setBusy(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }

  // ── VUE 1 : Formulaire d'édition/création d'un article unique ──────────────
  if (form) {
    return (
      <form onSubmit={save}>
        <SectionHeader
          title={form.id ? 'Modifier l’article' : 'Nouvel article'}
          description="Le contenu alimente le bot : rédigez des réponses claires, précises et autonomes."
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
                  placeholder="Tarifs, Évaluations, Connexion…"
                />
              </Field>
              <Field label="Tags" hint="Séparés par des virgules (ex: note, session, jury).">
                <input
                  className={inputCls}
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="tarifs, abonnement, faq"
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

  // ── VUE 2 : Importer un fichier / document complet ────────────────────────
  if (importer) {
    return (
      <div className="space-y-5">
        <SectionHeader
          title="Importation & Conversion de Document"
          description="Déposez un document complet (.md, .json, .csv, .txt) pour le convertir et l'indexer automatiquement dans la base de connaissances."
        />

        {importer.stage === 'upload' && (
          <Card className="p-8 text-center">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={cn(
                'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition',
                dragActive ? 'border-lagoon-500 bg-lagoon-50/50' : 'border-mist-300 bg-mist-50/50 hover:border-mist-400'
              )}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lagoon-100 text-2xl text-lagoon-700">
                📄
              </div>
              <p className="mt-4 font-display text-base font-bold text-ink">
                Glissez-déposez votre document ici
              </p>
              <p className="mt-1 text-xs text-ink-500">
                Formats acceptés : Markdown (<code className="rounded bg-white px-1">.md</code>), JSON (<code className="rounded bg-white px-1">.json</code>), CSV (<code className="rounded bg-white px-1">.csv</code>), Texte brut (<code className="rounded bg-white px-1">.txt</code>)
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.json,.csv,.tsv,.txt"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="mt-5 rounded-xl bg-lagoon-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-lagoon-700 disabled:opacity-50"
              >
                {busy ? 'Analyse du document…' : 'Parcourir les fichiers'}
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setImporter(null)}
                className="rounded-xl border border-mist-300 px-4 py-2 text-xs font-medium text-ink-600 transition hover:bg-mist"
              >
                Retour
              </button>
            </div>
          </Card>
        )}

        {(importer.stage === 'preview' || importer.stage === 'importing') && (
          <div className="space-y-4">
            {/* Barre de contrôle d'import */}
            <Card className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-lagoon-100 px-2 py-0.5 text-xs font-bold text-lagoon-700">
                      {importer.articles.length} articles détectés
                    </span>
                    <span className="text-xs font-medium text-ink-500">Fichier : {importer.fileName}</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    Vérifiez la segmentation ci-dessous avant d&apos;indexer les articles pour Lumi.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Mode d'importation */}
                  <select
                    value={importer.mode}
                    onChange={(e) => setImporter({ ...importer, mode: e.target.value as 'append' | 'replace' })}
                    disabled={importer.stage === 'importing'}
                    className="rounded-xl border border-mist-300 bg-white px-3 py-2 text-xs font-medium text-ink shadow-sm"
                  >
                    <option value="append">Ajouter aux {articles.length} articles existants</option>
                    <option value="replace">⚠️ Remplacer toute la base de connaissances</option>
                  </select>

                  <button
                    type="button"
                    onClick={executeImport}
                    disabled={importer.stage === 'importing' || busy}
                    className="rounded-xl bg-lagoon-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-lagoon-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {importer.stage === 'importing' ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Indexation en cours (Mistral)…</span>
                      </>
                    ) : (
                      <span>🚀 Confirmer et Indexer ({importer.articles.length})</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setImporter(null)}
                    disabled={importer.stage === 'importing'}
                    className="rounded-xl border border-mist-300 px-3 py-2 text-xs font-medium text-ink-600 transition hover:bg-mist"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </Card>

            {/* Liste des articles détectés */}
            <div className="space-y-2">
              {importer.articles.map((art, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-mist-200 bg-white p-4 shadow-sm transition hover:border-lagoon-300"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lagoon-50 text-[10px] font-bold text-lagoon-700">
                        {idx + 1}
                      </span>
                      <h3 className="truncate font-display text-xs font-bold text-ink">{art.title}</h3>
                      <span className="rounded bg-mist px-2 py-0.5 text-[10px] text-ink-500 shrink-0">
                        {art.category}
                      </span>
                    </div>
                    <span className="text-[11px] text-ink-400 shrink-0">{art.content.length} caractères</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-ink-600 leading-relaxed bg-mist-50/50 rounded-lg p-2">
                    {art.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── VUE 3 : Liste des articles existants ───────────────────────────────────
  return (
    <div className="animate-fade-in">
      <SectionHeader
        title="Base de connaissances"
        description="Les articles sont convertis en vecteurs (Mistral Embeddings) pour la recherche sémantique du bot Lumi."
      />
      <FormNotice kind={notice?.kind ?? 'ok'} text={notice?.text ?? null} />

      <div className="mt-3 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-medium text-ink-500">
          {loading
            ? 'Indexation en cours…'
            : `${articles.length} article${articles.length > 1 ? 's' : ''}` +
              (unindexedCount > 0 ? ` · ${unindexedCount} non indexé${unindexedCount > 1 ? 's' : ''}` : '')}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {/* Bouton d'import de document complet */}
          <button
            onClick={() => {
              setImporter({
                stage: 'upload',
                fileName: '',
                rawContent: '',
                mode: 'append',
                articles: []
              });
              setNotice(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-mist-300 bg-white px-3.5 py-2 text-xs font-semibold text-ink shadow-sm transition hover:bg-mist hover:border-mist-400 active:scale-95"
          >
            <span>📥</span>
            <span>Déposer un document</span>
          </button>

          {unindexedCount > 0 && (
            <button
              onClick={reindex}
              disabled={busy}
              className="rounded-xl border border-lagoon-300 bg-lagoon-50 px-3.5 py-2 text-xs font-semibold text-lagoon-700 transition hover:bg-lagoon-100 disabled:opacity-50"
            >
              ⚡ Régénérer les index ({unindexedCount})
            </button>
          )}

          <button
            onClick={() => {
              setForm(EMPTY);
              setNotice(null);
            }}
            className="rounded-xl bg-lagoon-600 px-4 py-2 text-xs font-semibold text-white shadow-glow-sm transition hover:bg-lagoon-500 active:scale-95"
          >
            + Nouvel article
          </button>
        </div>
      </div>

      {/* 🔍 Barre de Recherche en Direct & Filtres Catégories */}
      {!loading && articles.length > 0 && (
        <div className="mb-4 space-y-2.5">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par mot-clé, question, tag ou titre…"
              className="w-full rounded-2xl border border-mist-300 bg-white py-2.5 pl-10 pr-4 text-xs text-ink placeholder:text-ink-400 outline-none transition focus:border-lagoon-400 focus:ring-2 focus:ring-lagoon-400/20 shadow-sm"
            />
            <span className="pointer-events-none absolute left-3.5 top-2.5 text-ink-400">
              🔍
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-2.5 text-xs text-ink-400 hover:text-ink"
              >
                ✕
              </button>
            )}
          </div>

          {/* Pilules de Catégories */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setSelectedCat('all')}
              className={cn(
                'rounded-xl px-3 py-1 font-medium transition',
                selectedCat === 'all'
                  ? 'bg-ink text-white shadow-sm'
                  : 'bg-white text-ink-600 border border-mist-300 hover:bg-mist'
              )}
            >
              Tous ({articles.length})
            </button>

            {unindexedCount > 0 && (
              <button
                type="button"
                onClick={() => setSelectedCat('unindexed')}
                className={cn(
                  'rounded-xl px-3 py-1 font-medium transition',
                  selectedCat === 'unindexed'
                    ? 'bg-coral-500 text-white shadow-sm'
                    : 'bg-coral-50 text-coral-600 border border-coral-300 hover:bg-coral-100'
                )}
              >
                Non indexés ({unindexedCount})
              </button>
            )}

            {categories.map((cat) => {
              const count = articles.filter((a) => a.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCat(cat)}
                  className={cn(
                    'rounded-xl px-3 py-1 font-medium transition',
                    selectedCat === cat
                      ? 'bg-lagoon-600 text-white shadow-sm'
                      : 'bg-white text-ink-600 border border-mist-300 hover:bg-mist'
                  )}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading && <SkeletonList count={4} />}

      {!loading && articles.length === 0 && (
        <EmptyState
          icon="📚"
          title="Aucun article pour l'instant"
          description="Déposez vos documents d'entreprise (.md, .json, .csv) ou créez des articles manuellement pour que l'IA réponde précisément à vos clients."
          action={
            <button
              onClick={() =>
                setImporter({
                  stage: 'upload',
                  fileName: '',
                  rawContent: '',
                  mode: 'append',
                  articles: []
                })
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-lagoon-600 px-4 py-2.5 text-xs font-semibold text-white shadow-glow-sm transition hover:bg-lagoon-500"
            >
              <span>📥 Déposer un document (.md, .json, .csv)</span>
            </button>
          }
        />
      )}

      {!loading && articles.length > 0 && filteredArticles.length === 0 && (
        <EmptyState
          icon="🔎"
          title="Aucun article correspondant"
          description={`Aucun résultat ne correspond à votre recherche « ${searchQuery} ».`}
          action={
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCat('all');
              }}
              className="rounded-xl border border-mist-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-600 hover:bg-mist"
            >
              Réinitialiser les filtres
            </button>
          }
        />
      )}

      {!loading && filteredArticles.length > 0 && (
        <ul className="space-y-2.5">
          {filteredArticles.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 rounded-2xl border border-mist-300/80 bg-white p-4 shadow-panel transition hover:shadow-card-hover hover:border-mist-400"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-bold text-ink">{a.title}</p>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                      a.indexed ? 'bg-lagoon-100 text-lagoon-700' : 'bg-coral-50 text-coral-600 border border-coral-300'
                    )}
                  >
                    {a.indexed ? 'Indexé' : 'Non indexé'}
                  </span>
                  {a.category && (
                    <span className="rounded-full bg-mist-100 px-2 py-0.5 text-[11px] font-medium text-ink-600 border border-mist-200">
                      {a.category}
                    </span>
                  )}
                  {a.tags && a.tags.length > 0 && (
                    <span className="text-[11px] text-ink-400 font-mono">
                      #{a.tags.slice(0, 3).join(' #')}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-ink-400">
                  Modifié {timeAgo(a.updated_at)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => startEdit(a.id)}
                  disabled={busy}
                  className="rounded-xl border border-mist-300 bg-white px-3 py-1.5 text-xs font-semibold text-lagoon-700 transition hover:bg-lagoon-50 hover:border-lagoon-300"
                >
                  Modifier
                </button>
                <button
                  onClick={() => remove(a.id)}
                  className="rounded-xl px-2.5 py-1.5 text-xs font-medium text-ink-400 transition hover:bg-coral-50 hover:text-coral-600"
                  title="Supprimer l'article"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}