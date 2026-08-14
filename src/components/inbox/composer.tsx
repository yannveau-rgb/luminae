'use client';

/**
 * Zone de rédaction agent : éditeur riche (gras/italique/listes/liens),
 * insertion de réponses prédéfinies via « / », pièces jointes (bouton + collage
 * Ctrl+V), notes internes. Produit du HTML sanitisé côté serveur.
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

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { conversationId, visitorName, agentName, noteMode, sending, onSubmit, onTyping },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [empty, setEmpty] = useState(true);

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
      // Si le curseur n'est pas dans l'éditeur (ex. appel depuis le panneau
      // Copilot sans focus préalable), on place l'insertion en fin de contenu.
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
    const len = el?.textContent?.length ?? 0;
    setCharCount(len);
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
          // On sélectionne réellement le token « /xxx » (pas juste un Range
          // détaché) pour qu'insertText le remplace de façon atomique et fiable.
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
      {/* Picker réponses prédéfinies */}
      {pickerOpen && matches.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-80 overflow-hidden rounded-xl border border-mist-300 bg-white shadow-panel">
          <p className="border-b border-mist-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
            Réponses rapides
          </p>
          <ul>
            {matches.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickCanned(c);
                  }}
                  className={cn(
                    'block w-full px-3 py-2 text-left transition',
                    i === highlight ? 'bg-lagoon-50' : 'hover:bg-mist'
                  )}
                >
                  <span className="text-sm font-medium">
                    <span className="text-lagoon-600">/{c.shortcode}</span> · {c.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-400">{c.content}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Barre d'outils haute précision */}
      <div className="mb-2 flex items-center justify-between border-b border-mist-200 pb-1.5">
        <div className="flex items-center gap-0.5">
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
          <ToolButton label="Insérer un lien" onClick={openLinkModal}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </ToolButton>
          <span className="mx-1 h-3.5 w-px bg-mist-300" />
          <ToolButton label="Joindre un fichier (Images, PDF, Documents)" onClick={() => fileInputRef.current?.click()}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </ToolButton>
          {uploading && <span className="ml-1 text-[11px] text-lagoon-600 font-medium animate-pulse">Téléversement…</span>}
        </div>

        <button
          type="button"
          onClick={() => {
            setQuery('');
            setPickerOpen((o) => !o);
          }}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-lagoon-700 bg-lagoon-50 hover:bg-lagoon-100 transition"
          title="Ouvrir les réponses prédéfinies (/)"
        >
          <span>⚡</span>
          <span>Réponses rapides</span>
          <kbd className="hidden sm:inline rounded bg-white px-1 text-[10px] text-ink-500 border border-mist-300 font-mono shadow-sm">/</kbd>
        </button>
      </div>

      {/* Erreur d'upload éventuelle */}
      {uploadError && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-coral-50 px-3 py-1.5 text-xs text-coral-600">
          <span>{uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)} className="ml-2 font-bold hover:underline">
            ✕
          </button>
        </div>
      )}

      {/* Pièces jointes en attente */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((a, i) => (
            <span
              key={a.storage_path}
              className="inline-flex items-center gap-1.5 rounded-lg border border-mist-300 bg-mist px-2 py-1 text-xs"
            >
              {a.mime_type.startsWith('image/') ? '🖼️' : '📄'} {a.file_name}
              <button
                type="button"
                onClick={() => setAttachments((list) => list.filter((_, j) => j !== i))}
                className="text-ink-400 hover:text-coral-600"
                aria-label="Retirer"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
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
            className="rich-content max-h-48 min-h-[46px] w-full overflow-y-auto rounded-xl border border-mist-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-lagoon-300"
            suppressContentEditableWarning
          />
          {empty && (
            <span className="pointer-events-none absolute left-3.5 top-2.5 text-sm text-ink-400">
              {noteMode
                ? 'Note interne (invisible pour le visiteur)… « / » pour une réponse rapide'
                : 'Répondre… « / » pour une réponse rapide, Ctrl+V pour coller une image'}
            </span>
          )}
          {charCount >= 3000 && (
            <span
              className={cn(
                'absolute bottom-1 right-2 rounded px-1.5 py-0.5 text-[10px] font-medium',
                charCount >= 3800 ? 'bg-coral-50 text-coral-600' : 'bg-mist text-ink-500'
              )}
            >
              {charCount}/4000
            </span>
          )}
        </div>
        <button
          onClick={submit}
          disabled={sending}
          className={cn(
            'h-11 shrink-0 rounded-xl px-4 text-sm font-semibold text-white transition disabled:opacity-40',
            noteMode ? 'bg-sun-600 hover:bg-sun-700' : 'bg-lagoon-600 hover:bg-lagoon-700'
          )}
        >
          {sending ? '…' : noteMode ? 'Noter' : 'Envoyer'}
        </button>
      </div>

      <p className="mt-1 text-right text-[10.5px] text-ink-400">
        Entrée pour envoyer · Maj+Entrée pour saut de ligne
      </p>

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
            <h3 id="link-dialog-title" className="font-display text-sm font-semibold text-ink">
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
                  className="w-full rounded-lg border border-mist-300 px-3 py-2 text-sm outline-none focus:border-lagoon-400"
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
                  className="w-full rounded-lg border border-mist-300 px-3 py-2 text-sm outline-none focus:border-lagoon-400"
                />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setLinkDialogOpen(false)}
                className="rounded-lg border border-mist-300 px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-mist"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!linkUrl.trim() || !/^https?:\/\//i.test(linkUrl.trim())}
                className="rounded-lg bg-lagoon-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-lagoon-700 disabled:opacity-40"
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
      className="flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-sm text-ink-600 transition hover:bg-mist"
    >
      {children}
    </button>
  );
}
