'use client';

/**
 * Zone de rédaction agent haute performance :
 * Éditeur riche adaptable (auto-extensible + mode grand confort),
 * insertion rapide de variables/réponses (/), pièces jointes,
 * notes internes sécurisées, statistiques de frappe et raccourcis.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { CannedResponse } from '@/lib/types';

export interface ComposerHandle {
  /** Insère du texte au niveau du curseur (utilisé par le Copilot). */
  insertText: (text: string) => void;
  focus: () => void;
}

export interface PendingAttachment {
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
}

interface ComposerProps {
  conversationId: string;
  visitorName: string;
  agentName: string;
  noteMode: boolean;
  sending: boolean;
  onSubmit: (payload: { contentHtml: string; attachments: PendingAttachment[] }) => void;
  onTyping: (on: boolean) => void;
}

/** Résout les variables {{contact}} / {{agent}} d'une réponse prédéfinie. */
function resolveVariables(content: string, vars: { contact: string; agent: string }): string {
  return content
    .replace(/\{\{\s*(contact|nom|name)\s*\}\}/gi, vars.contact)
    .replace(/\{\{\s*agent\s*\}\}/gi, vars.agent);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { conversationId, visitorName, agentName, noteMode, sending, onSubmit, onTyping },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [empty, setEmpty] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Réponses prédéfinies
  const [canned, setCanned] = useState<CannedResponse[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  // Liens et uploads
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    fetch('/api/agent/canned', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setCanned(j.canned ?? []))
      .catch(() => {});
  }, []);

  useImperativeHandle(ref, () => ({
    insertText(text: string) {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (sel && (sel.rangeCount === 0 || !el.contains(sel.getRangeAt(0).startContainer))) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      document.execCommand('insertText', false, text);
      syncEmpty();
    },
    focus() {
      editorRef.current?.focus();
    }
  }));

  const syncEmpty = useCallback(() => {
    const el = editorRef.current;
    const text = el?.textContent ?? '';
    const len = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setCharCount(len);
    setWordCount(words);
    setEmpty(!el || len === 0);
  }, []);

  // Filtre des réponses prédéfinies sur le raccourci ou le titre.
  const matches = canned
    .filter((c) => {
      if (!query) return true;
      return c.shortcode.startsWith(query) || c.title.toLowerCase().includes(query);
    })
    .slice(0, 6);

  /** Détecte un token « /xxx » juste avant le curseur pour ouvrir le picker. */
  function detectSlash() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return setPickerOpen(false);
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return setPickerOpen(false);
    const textBefore = node.textContent!.slice(0, range.startOffset);
    const m = /(?:^|\s)\/([a-z0-9_-]*)$/i.exec(textBefore);
    if (m) {
      setQuery(m[1].toLowerCase());
      setHighlight(0);
      setPickerOpen(true);
    } else {
      setPickerOpen(false);
    }
  }

  /** Insère une réponse prédéfinie en remplaçant le token « /xxx ». */
  function pickCanned(c: CannedResponse) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0).cloneRange();
      const node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        const before = node.textContent!.slice(0, range.startOffset);
        const m = /\/[a-z0-9_-]*$/i.exec(before);
        if (m) {
          range.setStart(node, range.startOffset - m[0].length);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }
    const text = resolveVariables(c.content, { contact: visitorName || 'vous', agent: agentName || '' });
    document.execCommand('insertText', false, text);
    setPickerOpen(false);
    setQuery('');
    syncEmpty();
  }

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  }

  function openLinkModal() {
    const sel = window.getSelection();
    const selected = sel ? sel.toString() : '';
    setLinkText(selected);
    setLinkUrl('');
    setLinkDialogOpen(true);
  }

  function confirmLink(e: React.FormEvent) {
    e.preventDefault();
    const cleanUrl = linkUrl.trim();
    if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) return;
    editorRef.current?.focus();
    if (linkText.trim()) {
      document.execCommand('insertHTML', false, `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${linkText.trim()}</a>`);
    } else {
      exec('createLink', cleanUrl);
    }
    setLinkDialogOpen(false);
    setLinkUrl('');
    setLinkText('');
    syncEmpty();
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    setUploadError(null);
    for (const file of list) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('conversationId', conversationId);
      try {
        const res = await fetch('/api/agent/attachments', { method: 'POST', body: fd });
        const j = await res.json();
        if (res.ok && j.attachment) {
          setAttachments((a) => [...a, j.attachment]);
        } else {
          setUploadError(j.error ?? `Échec de l'envoi de ${file.name}`);
        }
      } catch {
        setUploadError(`Erreur réseau lors de l'envoi de ${file.name}`);
      }
    }
    setUploading(false);
  }

  function onPaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData.items);
    const imgs = items.filter((it) => it.kind === 'file' && it.type.startsWith('image/'));
    if (imgs.length > 0) {
      e.preventDefault();
      const files = imgs.map((it) => it.getAsFile()).filter((f): f is File => !!f);
      uploadFiles(files);
    }
  }

  function submit() {
    const el = editorRef.current;
    const html = el?.innerHTML ?? '';
    const hasText = (el?.textContent ?? '').trim().length > 0;
    if ((!hasText && attachments.length === 0) || sending) return;
    onSubmit({ contentHtml: hasText ? html : '', attachments });
    if (el) el.innerHTML = '';
    setAttachments([]);
    setEmpty(true);
    setCharCount(0);
    setWordCount(0);
    setUploadError(null);
    onTyping(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (pickerOpen && matches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => (h + 1) % matches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => (h - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickCanned(matches[highlight]);
        return;
      }
      if (e.key === 'Escape') {
        setPickerOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="relative">
      {/* Bandeau de réassurance Note Privée */}
      {noteMode && (
        <div className="mb-2.5 flex items-center justify-between rounded-xl border border-sun-300 bg-sun-100/80 px-3.5 py-1.5 text-xs text-sun-700 shadow-sm animate-fade-in">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="text-sm">🔒</span>
            <span>Note d&apos;équipe confidentielle</span>
            <span className="font-medium text-sun-600 text-[11px] hidden sm:inline">
              · Invisible pour le client, enregistrée dans le fil d&apos;activité
            </span>
          </div>
          <span className="rounded bg-sun-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-sun-700 border border-sun-300">
            PRIVÉ
          </span>
        </div>
      )}

      {/* Picker réponses prédéfinies flottant */}
      {pickerOpen && matches.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-88 overflow-hidden rounded-2xl border border-mist-300 bg-white shadow-panel z-30 animate-slide-up">
          <div className="flex items-center justify-between border-b border-mist-200 px-3.5 py-2 bg-mist-50">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-500">
              ⚡ Réponses rapides disponibles
            </span>
            <span className="text-[10px] text-ink-400 font-mono">Entrée ou Tab pour insérer</span>
          </div>
          <ul className="divide-y divide-mist-100 max-h-60 overflow-y-auto">
            {matches.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickCanned(c);
                  }}
                  className={cn(
                    'block w-full px-3.5 py-2.5 text-left transition',
                    i === highlight ? 'bg-lagoon-50' : 'hover:bg-mist-50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">
                      <span className="text-lagoon-600 font-mono">/{c.shortcode}</span> · {c.title}
                    </span>
                    <span className="text-[10px] text-ink-400 font-medium">Insérer</span>
                  </div>
                  <span className="mt-1 block line-clamp-2 text-xs text-ink-500 leading-relaxed">{c.content}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Barre d'outils haute précision */}
      <div className="mb-2 flex items-center justify-between border-b border-mist-200 pb-2">
        <div className="flex items-center gap-1">
          <ToolButton label="Gras (Ctrl+B)" onClick={() => exec('bold')}>
            <span className="font-bold text-xs">B</span>
          </ToolButton>
          <ToolButton label="Italique (Ctrl+I)" onClick={() => exec('italic')}>
            <span className="italic text-xs font-serif">I</span>
          </ToolButton>
          <ToolButton label="Liste à puces" onClick={() => exec('insertUnorderedList')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </ToolButton>
          <ToolButton label="Insérer un lien (URL)" onClick={openLinkModal}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </ToolButton>
          <span className="mx-1 h-3.5 w-px bg-mist-300" />
          <ToolButton label="Joindre des fichiers (Images, PDF, Documents)" onClick={() => fileInputRef.current?.click()}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </ToolButton>
          {uploading && <span className="ml-1 text-[11px] text-lagoon-600 font-semibold animate-pulse">Téléversement en cours…</span>}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="hidden sm:inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-ink-600 hover:bg-mist transition"
            title={expanded ? 'Réduire la zone de saisie' : 'Agrandir la zone de saisie pour les longs textes'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {expanded ? (
                <path d="M4 14h6v6m10-10h-6V4m0 6l7-7M4 20l6-6" />
              ) : (
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              )}
            </svg>
            <span>{expanded ? 'Réduire' : 'Agrandir'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setQuery('');
              setPickerOpen((o) => !o);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold text-lagoon-700 bg-lagoon-50 hover:bg-lagoon-100 transition border border-lagoon-200"
            title="Ouvrir les réponses prédéfinies (/)"
          >
            <span>⚡</span>
            <span>Réponses rapides</span>
            <kbd className="hidden sm:inline rounded bg-white px-1 text-[10px] text-ink-500 border border-mist-300 font-mono shadow-sm">/</kbd>
          </button>
        </div>
      </div>

      {/* Erreur d'upload éventuelle */}
      {uploadError && (
        <div className="mb-2 flex items-center justify-between rounded-xl bg-coral-50 border border-coral-300 px-3.5 py-2 text-xs text-coral-600">
          <span>⚠️ {uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)} className="ml-2 font-bold hover:underline">
            ✕
          </button>
        </div>
      )}

      {/* Pièces jointes en attente */}
      {attachments.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <div
              key={a.storage_path}
              className="inline-flex items-center gap-2 rounded-xl border border-mist-300 bg-mist-50 px-2.5 py-1.5 text-xs shadow-sm"
            >
              <span>{a.mime_type.startsWith('image/') ? '🖼️' : '📄'}</span>
              <div className="flex flex-col">
                <span className="font-medium text-ink max-w-[160px] truncate">{a.file_name}</span>
                <span className="text-[10px] text-ink-400 font-mono">{formatBytes(a.size_bytes)}</span>
              </div>
              <button
                type="button"
                onClick={() => setAttachments((list) => list.filter((_, j) => j !== i))}
                className="ml-1 text-ink-400 hover:text-coral-600 text-xs font-bold"
                aria-label="Retirer"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Zone de texte principale (Extensible avec grand confort de lecture) */}
      <div className="flex items-end gap-2.5">
        <div className="relative min-w-0 flex-1">
          <div
            ref={editorRef}
            contentEditable
            role="textbox"
            aria-multiline="true"
            aria-label={noteMode ? 'Note interne' : 'Réponse au visiteur'}
            onInput={() => {
              syncEmpty();
              detectSlash();
              onTyping(true);
            }}
            onKeyDown={onKeyDown}
            onKeyUp={detectSlash}
            onClick={detectSlash}
            onPaste={onPaste}
            onBlur={() => onTyping(false)}
            className={cn(
              'rich-content w-full overflow-y-auto rounded-2xl border p-3.5 text-sm leading-relaxed text-ink outline-none transition',
              noteMode
                ? 'border-sun-300 bg-sun-50/60 focus:border-sun-500 focus:ring-2 focus:ring-sun-300/30'
                : 'border-mist-300 bg-white focus:border-lagoon-400 focus:ring-2 focus:ring-lagoon-400/20',
              expanded ? 'min-h-[220px] max-h-[420px]' : 'min-h-[76px] max-h-64'
            )}
            suppressContentEditableWarning
          />
          {empty && (
            <span className="pointer-events-none absolute left-4 top-3.5 text-sm text-ink-400 leading-relaxed">
              {noteMode
                ? 'Rédiger une consigne ou une note pour l’équipe… tapez « / » pour insérer un modèle'
                : 'Rédiger votre réponse au visiteur… tapez « / » pour les réponses rapides, Ctrl+V pour coller une image'}
            </span>
          )}
        </div>

        {/* Bouton d'envoi ergonomique */}
        <button
          onClick={submit}
          disabled={sending}
          className={cn(
            'flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold text-white shadow-glow-sm transition disabled:opacity-40',
            noteMode ? 'bg-sun-600 hover:bg-sun-700' : 'bg-lagoon-600 hover:bg-lagoon-500'
          )}
        >
          {sending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              <span>{noteMode ? '🔒 Noter' : 'Envoyer'}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* Barre de statut et raccourcis en pied d'éditeur */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-400">
        <div className="flex items-center gap-2">
          {charCount > 0 && (
            <span>
              {charCount} caractères · {wordCount} mots
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span><kbd className="rounded bg-mist-100 px-1 py-0.5 font-mono text-[10px] text-ink-600 border border-mist-300">Entrée</kbd> pour envoyer</span>
          <span>·</span>
          <span><kbd className="rounded bg-mist-100 px-1 py-0.5 font-mono text-[10px] text-ink-600 border border-mist-300">Maj+Entrée</kbd> saut de ligne</span>
        </div>
      </div>

      {/* Modale d'insertion de lien accessible */}
      {linkDialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="link-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setLinkDialogOpen(false);
          }}
        >
          <form
            onSubmit={confirmLink}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-panel"
          >
            <h3 id="link-dialog-title" className="font-display text-sm font-bold text-ink">
              Insérer un lien hypertexte
            </h3>
            <div className="mt-3 space-y-2.5">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600">Texte affiché</span>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Ex. Guide d'utilisation"
                  className="w-full rounded-xl border border-mist-300 px-3 py-2 text-sm outline-none focus:border-lagoon-400"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600">URL cible (https://…)</span>
                <input
                  type="url"
                  required
                  autoFocus
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://exemple.fr/doc"
                  className="w-full rounded-xl border border-mist-300 px-3 py-2 text-sm outline-none focus:border-lagoon-400"
                />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setLinkDialogOpen(false)}
                className="rounded-xl border border-mist-300 px-3.5 py-1.5 text-xs font-semibold text-ink-600 hover:bg-mist"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!linkUrl.trim() || !/^https?:\/\//i.test(linkUrl.trim())}
                className="rounded-xl bg-lagoon-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-lagoon-500 disabled:opacity-40 shadow-sm"
              >
                Insérer le lien
              </button>
            </div>
          </form>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) uploadFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
});

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-sm text-ink-600 transition hover:bg-mist hover:text-ink"
    >
      {children}
    </button>
  );
}
