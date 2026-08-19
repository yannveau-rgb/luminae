'use client';

/**
 * Base de connaissances professionnelle :
 * Éditeur Markdown avec prévisualisation en direct, barre d'outils riche,
 * assistant IA Mistral (polissage, génération FAQ, tags), import/export complet,
 * recherche instantanée et filtres par catégories.
 */

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
  const [previewTab, setPreviewTab] = useState<'edit' | 'preview'>('edit');
  const [aiBusy, setAiBusy] = useState<'improve' | 'faq' | 'tags' | null>(null);
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
      setPreviewTab('edit');
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

  async function runAiAssist(mode: 'improve' | 'faq' | 'tags') {
    if (!form || !form.content.trim() || aiBusy) return;
    setAiBusy(mode);
    try {
      const res = await fetch('/api/admin/articles/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, title: form.title, content: form.content })
      });
      const data = await res.json();
      if (res.ok) {
        if (mode === 'improve' && data.result) {
          setForm({ ...form, content: data.result });
          setNotice({ kind: 'ok', text: '✨ Article amélioré et structuré avec succès par l’IA Mistral.' });
        } else if (mode === 'faq' && data.result) {
          setForm({ ...form, content: `${form.content.trim()}\n\n---\n\n## ❓ Questions Fréquentes Associées\n\n${data.result}` });
          setNotice({ kind: 'ok', text: '💡 FAQ générée et ajoutée à l’article.' });
        } else if (mode === 'tags') {
          setForm({
            ...form,
            category: data.category || form.category,
            tags: data.tags ? (form.tags ? `${form.tags}, ${data.tags}` : data.tags) : form.tags
          });
          setNotice({ kind: 'ok', text: '🏷️ Catégorie et mots-clés suggérés avec succès.' });
        }
      } else {
        setNotice({ kind: 'error', text: data.error || 'Erreur lors de l’assistance IA.' });
      }
    } catch {
      setNotice({ kind: 'error', text: 'Impossible de contacter l’assistance IA.' });
    } finally {
      setAiBusy(null);
    }
  }

  function insertMarkdown(prefix: string, suffix: string = '') {
    if (!form) return;
    const textarea = document.getElementById('article-content-area') as HTMLTextAreaElement;
    if (!textarea) {
      setForm({ ...form, content: `${form.content}\n${prefix}${suffix}` });
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = form.content;
    const selection = text.substring(start, end) || 'texte';
    const replacement = `${prefix}${selection}${suffix}`;
    const newContent = text.substring(0, start) + replacement + text.substring(end);
    setForm({ ...form, content: newContent });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selection.length);
    }, 50);
  }

  function exportKnowledgeBase() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(articles, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `luminae-knowledge-base-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
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
      <form onSubmit={save} className="space-y-4 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader
            title={form.id ? 'Modifier l’article' : 'Nouvel article de connaissances'}
            description="Le contenu alimente le bot Lumi et le Copilot conseiller : rédigez des réponses claires, précises et structurées."
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-xl border border-mist-300 bg-white px-3.5 py-2 text-xs font-semibold text-ink-600 transition hover:bg-mist"
            >
              Annuler
            </button>
            <SaveButton busy={busy} label={form.id ? 'Mettre à jour' : 'Enregistrer & Indexer'} />
          </div>
        </div>

        <FormNotice kind={notice?.kind ?? 'ok'} text={notice?.text ?? null} />

        <Card className="p-5 space-y-4">
          <Field label="Titre de l'article" required hint="Formulez un titre explicite (ex: Comment effectuer un retour sous 14 jours ?)">
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Procédure de remboursement et délais bancaires"
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Catégorie" hint="Ex: Livraison, Retours, Tarifs, Support…">
              <input
                className={inputCls}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Retours & Remboursements"
              />
            </Field>
            <Field label="Mots-clés / Tags" hint="Séparés par des virgules pour faciliter la recherche.">
              <input
                className={inputCls}
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="retour, colis, 14 jours, rib, virement"
              />
            </Field>
          </div>

          {/* ✨ Assistant IA Mistral pour la rédaction */}
          <div className="rounded-2xl border border-aurora-300/80 bg-gradient-to-r from-aurora-100/50 via-white to-lagoon-50/40 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-aurora-300/60 text-xs">
                  ✨
                </span>
                <span className="font-display text-xs font-bold text-ink">
                  Assistant IA Mistral
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={!form.content.trim() || aiBusy !== null}
                  onClick={() => runAiAssist('improve')}
                  className="inline-flex items-center gap-1 rounded-xl bg-white border border-aurora-300 px-2.5 py-1 text-xs font-semibold text-lagoon-700 shadow-sm transition hover:bg-aurora-100 disabled:opacity-40"
                >
                  {aiBusy === 'improve' ? '✨ Structuration…' : '✨ Structurer & Polir'}
                </button>
                <button
                  type="button"
                  disabled={!form.content.trim() || aiBusy !== null}
                  onClick={() => runAiAssist('faq')}
                  className="inline-flex items-center gap-1 rounded-xl bg-white border border-aurora-300 px-2.5 py-1 text-xs font-semibold text-lagoon-700 shadow-sm transition hover:bg-aurora-100 disabled:opacity-40"
                >
                  {aiBusy === 'faq' ? '💡 Génération…' : '💡 Générer FAQ associée'}
                </button>
                <button
                  type="button"
                  disabled={!form.content.trim() || aiBusy !== null}
                  onClick={() => runAiAssist('tags')}
                  className="inline-flex items-center gap-1 rounded-xl bg-white border border-aurora-300 px-2.5 py-1 text-xs font-semibold text-lagoon-700 shadow-sm transition hover:bg-aurora-100 disabled:opacity-40"
                >
                  {aiBusy === 'tags' ? '🏷️ Analyse…' : '🏷️ Suggérer Catégorie & Tags'}
                </button>
              </div>
            </div>
          </div>

          {/* Éditeur avec barre d'outils Markdown et onglets Mode Édition / Prévisualisation */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-ink-700">Contenu de l&apos;article</span>
              <div className="flex items-center rounded-xl border border-mist-300 bg-mist-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewTab('edit')}
                  className={cn(
                    'rounded-lg px-3 py-1 font-medium transition',
                    previewTab === 'edit' ? 'bg-white text-ink shadow-sm' : 'text-ink-500 hover:text-ink'
                  )}
                >
                  ✏️ Rédiger
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('preview')}
                  className={cn(
                    'rounded-lg px-3 py-1 font-medium transition',
                    previewTab === 'preview' ? 'bg-white text-ink shadow-sm' : 'text-ink-500 hover:text-ink'
                  )}
                >
                  👁️ Aperçu direct
                </button>
              </div>
            </div>

            {previewTab === 'edit' ? (
              <div className="space-y-1.5">
                {/* Barre d'outils Markdown */}
                <div className="flex flex-wrap items-center gap-1 rounded-xl border border-mist-200 bg-mist-50/80 p-1.5 text-xs text-ink-600">
                  <button
                    type="button"
                    onClick={() => insertMarkdown('## ')}
                    className="rounded-lg px-2 py-1 font-bold hover:bg-white hover:shadow-sm"
                    title="Titre H2"
                  >
                    H2
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('### ')}
                    className="rounded-lg px-2 py-1 font-bold hover:bg-white hover:shadow-sm"
                    title="Titre H3"
                  >
                    H3
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('**', '**')}
                    className="rounded-lg px-2 py-1 font-bold hover:bg-white hover:shadow-sm"
                    title="Gras"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('*', '*')}
                    className="rounded-lg px-2 py-1 italic hover:bg-white hover:shadow-sm"
                    title="Italique"
                  >
                    I
                  </button>
                  <span className="h-4 w-px bg-mist-300 mx-1" />
                  <button
                    type="button"
                    onClick={() => insertMarkdown('- ')}
                    className="rounded-lg px-2 py-1 hover:bg-white hover:shadow-sm"
                    title="Liste à puces"
                  >
                    • Liste
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('1. ')}
                    className="rounded-lg px-2 py-1 hover:bg-white hover:shadow-sm"
                    title="Liste numérotée"
                  >
                    1. Numéroté
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('> 💡 ')}
                    className="rounded-lg px-2 py-1 hover:bg-white hover:shadow-sm"
                    title="Encadré d'information"
                  >
                    💡 Info
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('> ⚠️ ')}
                    className="rounded-lg px-2 py-1 hover:bg-white hover:shadow-sm"
                    title="Avertissement"
                  >
                    ⚠️ Alerte
                  </button>
                </div>

                <textarea
                  id="article-content-area"
                  className={cn(inputCls, 'font-mono text-xs leading-relaxed')}
                  rows={14}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Rédigez ici le contenu de l'article en Markdown..."
                  required
                />
              </div>
            ) : (
              <div className="min-h-[320px] rounded-2xl border border-mist-300 bg-white p-5 leading-relaxed text-xs text-ink shadow-inner space-y-2.5">
                <h3 className="font-display text-base font-bold text-ink mb-3">{form.title || 'Titre de l’article'}</h3>
                <div className="whitespace-pre-wrap font-sans text-xs text-ink-800 leading-relaxed">
                  {form.content || 'Aucun contenu rédigé.'}
                </div>
              </div>
            )}
          </div>
        </Card>
      </form>
    );
  }

  // ── VUE 2 : Importer un fichier / document complet ────────────────────────
  if (importer) {
    return (
      <div className="space-y-5 animate-fade-in">
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
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-lagoon-600 px-5 py-2.5 text-xs font-semibold text-white shadow-glow-sm transition hover:bg-lagoon-500 disabled:opacity-50"
              >
                Parcourir mes fichiers…
              </button>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setImporter(null)}
                className="text-xs text-ink-500 hover:text-ink underline"
              >
                Annuler et retourner aux articles
              </button>
            </div>
          </Card>
        )}

        {importer.stage === 'preview' && (
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-mist-200 pb-3">
              <div>
                <p className="font-display text-sm font-bold text-ink">
                  Aperçu : {importer.articles.length} article(s) détecté(s)
                </p>
                <p className="text-xs text-ink-500">Source : {importer.fileName}</p>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importer.mode === 'append'}
                    onChange={() => setImporter({ ...importer, mode: 'append' })}
                    className="accent-lagoon-600"
                  />
                  <span>Ajouter aux existants</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importer.mode === 'replace'}
                    onChange={() => setImporter({ ...importer, mode: 'replace' })}
                    className="accent-lagoon-600"
                  />
                  <span className="text-coral-600 font-semibold">Remplacer toute la base</span>
                </label>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {importer.articles.map((art, idx) => (
                <div key={idx} className="rounded-xl border border-mist-200 bg-mist-50/50 p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-ink">{art.title}</span>
                    <span className="rounded bg-white px-2 py-0.5 text-[10px] font-medium text-ink-500 border border-mist-200">
                      {art.category || 'Général'}
                    </span>
                  </div>
                  <p className="text-ink-600 line-clamp-2">{art.content}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-mist-200">
              <button
                type="button"
                onClick={() => setImporter(null)}
                className="rounded-xl border border-mist-300 px-4 py-2 text-xs font-semibold text-ink-600 hover:bg-mist"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={executeImport}
                disabled={busy}
                className="rounded-xl bg-lagoon-600 px-5 py-2 text-xs font-semibold text-white shadow-glow-sm transition hover:bg-lagoon-500 disabled:opacity-50"
              >
                Importer {importer.articles.length} article(s) &rarr;
              </button>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ── VUE 3 : Liste des articles existants ───────────────────────────────────
  return (
    <div className="animate-fade-in">
      <SectionHeader
        title="Base de connaissances"
        description="Les articles sont convertis en vecteurs (Mistral Embeddings) pour la recherche sémantique du bot Lumi et les suggestions Copilot."
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
          {/* Bouton d'exportation */}
          {articles.length > 0 && (
            <button
              onClick={exportKnowledgeBase}
              className="inline-flex items-center gap-1.5 rounded-xl border border-mist-300 bg-white px-3 py-2 text-xs font-semibold text-ink shadow-sm transition hover:bg-mist hover:border-mist-400 active:scale-95"
              title="Exporter tous les articles au format JSON"
            >
              <span>📤</span>
              <span>Exporter</span>
            </button>
          )}

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
              setPreviewTab('edit');
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