'use client';

/** Espace de travail d'une conversation : fil, actions, composeur. */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { BotOrb, TypingDots } from '@/components/widget/parts';
import { cn, formatDay, formatTime, timeAgo } from '@/lib/utils';
import type { Agent, Attachment, Conversation, Message, Visitor } from '@/lib/types';
import { Avatar, DayDivider, StatusBadge } from './parts';
import { Composer, type ComposerHandle, type PendingAttachment } from './composer';

interface TeamMember {
  id: string;
  full_name: string | null;
  role: string;
}

export function ConversationView({ conversationId, agent }: { conversationId: string; agent: Agent }) {
  const supabase = supabaseBrowser();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [visitorTyping, setVisitorTyping] = useState(false);
  /** Abonnement refusé (policies 0010 absentes, jeton expiré) → on recharge. */
  const [realtimeDown, setRealtimeDown] = useState(false);
  const [noteMode, setNoteMode] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Copilot IA
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotBusy, setCopilotBusy] = useState(false);
  const [copilotText, setCopilotText] = useState('');
  const [copilotSources, setCopilotSources] = useState<{ id: string; title: string }[]>([]);
  // Brouillon « transformer en article »
  const [articleDraft, setArticleDraft] = useState<{
    title: string;
    category: string;
    tags: string;
    content: string;
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const composerRef = useRef<ComposerHandle>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/agent/conversations/${conversationId}`, { cache: 'no-store' });
    if (!res.ok) {
      setError('Conversation introuvable.');
      return;
    }
    const j = await res.json();
    setConv(j.conversation);
    setVisitor(j.visitor);
    setMessages(j.messages ?? []);
    setFeedback(j.feedback ?? {});
    if (j.conversation.unread_count > 0) {
      fetch(`/api/agent/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read' })
      }).catch(() => {});
    }
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch('/api/agent/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setTeam(j.team ?? []))
      .catch(() => {});
  }, []);

  // Défilement automatique vers le bas à chaque nouveau message.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, visitorTyping]);

  // Temps réel du canal conversation (canal PRIVÉ — voir migration 0010).
  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null;
    let disposed = false;

    const append = (payload: Message) => {
      if (!payload?.id) return;
      setMessages((ms) => (ms.some((m) => m.id === payload.id) ? ms : [...ms, payload]));
    };

    (async () => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken || disposed) return;
      await supabase.realtime.setAuth(accessToken);
      if (disposed) return;

      ch = supabase.channel(`conv:${conversationId}`, { config: { private: true } });
      ch.on('broadcast', { event: 'message:new' }, ({ payload }: { payload: Message }) => {
        if (payload?.internal_note) return; // diffusée uniquement via note:new
        append(payload);
      })
        .on('broadcast', { event: 'note:new' }, ({ payload }: { payload: Message }) => append(payload))
        .on('broadcast', { event: 'conversation:update' }, ({ payload }: { payload: Partial<Conversation> }) => {
          setConv((c) => (c ? { ...c, ...payload } : c));
        })
        .on('broadcast', { event: 'typing' }, ({ payload }: { payload: { from?: string; on?: boolean } }) => {
          if (payload?.from === 'visitor') setVisitorTyping(!!payload.on);
        })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeDown(true);
          else if (status === 'SUBSCRIBED') setRealtimeDown(false);
        });
    })();

    return () => {
      disposed = true;
      if (ch) supabase.removeChannel(ch);
    };
  }, [supabase, conversationId]);

  // Repli sans temps réel : rechargement périodique du fil. Plus court que
  // l'intervalle de la liste — ici l'agent attend une réponse en direct.
  useEffect(() => {
    if (!realtimeDown) return;
    const id = setInterval(() => load(), 10000);
    return () => clearInterval(id);
  }, [realtimeDown, load]);

  async function doAction(action: string, agent_id?: string) {
    const res = await fetch(`/api/agent/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, agent_id })
    });
    if (!res.ok) {
      setError('L’action n’a pas pu être effectuée.');
      return;
    }
    const j = await res.json();
    setConv(j.conversation);
  }

  function emitTyping(on: boolean) {
    fetch('/api/agent/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, on })
    }).catch(() => {});
  }

  function onTyping(on: boolean) {
    if (noteMode) return;
    if (on) {
      const now = Date.now();
      if (now - lastTypingSent.current > 1500) {
        lastTypingSent.current = now;
        emitTyping(true);
      }
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => emitTyping(false), 2000);
    } else {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      emitTyping(false);
    }
  }

  async function send(payload: { contentHtml: string; attachments: PendingAttachment[] }) {
    if (sending || (!payload.contentHtml && payload.attachments.length === 0)) return;
    setSending(true);
    setError(null);
    const tempId = `tmp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender: 'agent',
      agent_id: agent.id,
      content: payload.contentHtml ? '' : '(pièce jointe)',
      content_html: payload.contentHtml || null,
      internal_note: noteMode,
      created_at: new Date().toISOString(),
      agent_name: agent.full_name,
      attachments: payload.attachments.map((a) => ({
        id: `tmp-${a.storage_path}`,
        message_id: tempId,
        storage_path: a.storage_path,
        file_name: a.file_name,
        mime_type: a.mime_type,
        size_bytes: a.size_bytes,
        url: null
      })) as Attachment[]
    };
    setMessages((ms) => [...ms, optimistic]);
    onTyping(false);

    const res = await fetch('/api/agent/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        contentHtml: payload.contentHtml,
        internalNote: noteMode,
        attachments: payload.attachments
      })
    });
    if (!res.ok) {
      setMessages((ms) => ms.filter((m) => m.id !== tempId));
      setError('Le message n’a pas pu être envoyé.');
    } else {
      const j = await res.json();
      setMessages((ms) => ms.filter((m) => m.id !== tempId).concat(j.message));
      if (j.conversation) setConv(j.conversation);
    }
    setSending(false);
  }

  // ── Copilot IA : génère une suggestion de réponse ──────────────────────────
  async function runCopilot() {
    setCopilotOpen(true);
    setCopilotBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent/conversations/${conversationId}/copilot`, { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Suggestion indisponible.');
      setCopilotText(j.suggestion ?? '');
      setCopilotSources(j.sources ?? []);
    } catch (e) {
      setCopilotText('');
      setError(e instanceof Error ? e.message : 'Suggestion indisponible.');
      setCopilotOpen(false);
    } finally {
      setCopilotBusy(false);
    }
  }

  function insertCopilot() {
    setNoteMode(false);
    composerRef.current?.insertText(copilotText);
    composerRef.current?.focus();
    setCopilotOpen(false);
  }

  // ── Transformer un échange en article de la base de connaissances ──────────
  function openArticleDraft(agentMessage: Message) {
    // Question du visiteur la plus proche AVANT cette réponse d'agent.
    const idx = messages.findIndex((m) => m.id === agentMessage.id);
    let question = '';
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].sender === 'visitor' && !messages[i].internal_note) {
        question = messages[i].content;
        break;
      }
    }
    setArticleDraft({
      title: question.slice(0, 120) || 'Nouvel article',
      category: '',
      tags: '',
      content: agentMessage.content
    });
  }

  async function saveArticleDraft() {
    if (!articleDraft) return;
    setSending(true);
    setError(null);
    const res = await fetch('/api/agent/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: articleDraft.title,
        content: articleDraft.content,
        category: articleDraft.category,
        tags: articleDraft.tags.split(',').map((t) => t.trim()).filter(Boolean)
      })
    });
    const j = await res.json().catch(() => ({}));
    setSending(false);
    if (res.ok) {
      setArticleDraft(null);
      setError(j.indexError ? 'Article créé (indexation à refaire plus tard).' : null);
    } else {
      setError(j.error ?? 'L’article n’a pas pu être créé.');
    }
  }

  if (error && !conv) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-coral-600">{error}</p>
      </div>
    );
  }
  if (!conv) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-mist">
        <header className="flex h-14 items-center justify-between border-b border-mist-300 bg-white px-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 animate-pulse rounded-full bg-mist-300" />
            <div className="space-y-1.5">
              <div className="h-4 w-32 animate-pulse rounded bg-mist-300" />
              <div className="h-3 w-20 animate-pulse rounded bg-mist-200" />
            </div>
          </div>
        </header>
        <div className="flex-1 space-y-4 p-5">
          <div className="h-14 w-2/3 animate-pulse rounded-2xl bg-white" />
          <div className="ml-auto h-12 w-1/2 animate-pulse rounded-2xl bg-lagoon-100/50" />
          <div className="h-16 w-3/4 animate-pulse rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  const resolved = conv.status === 'resolved';
  const canTake = conv.status === 'waiting' || conv.status === 'bot';
  const assignedName = team.find((t) => t.id === conv.assigned_agent_id)?.full_name ?? null;

  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col bg-mist">
        {/* En-tête conversation — les actions passent sous l'identité quand la
            largeur ne suffit plus, plutôt que de comprimer les deux. */}
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-mist-300 bg-white px-4 py-3 md:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
            {/* Sous md, la liste et la conversation ne coexistent pas : sans ce
                retour, la conversation serait un cul-de-sac. */}
            <Link
              href="/inbox"
              aria-label="Retour à la liste des conversations"
              className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-500 transition hover:bg-mist md:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Avatar name={visitor?.display_name ?? 'Visiteur'} size={36} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold">{visitor?.display_name ?? 'Visiteur'}</span>
                <StatusBadge status={conv.status} />
              </div>
              <p className="truncate text-xs text-ink-500">
                {assignedName ? `Assignée à ${assignedName}` : canTake ? 'Non assignée' : 'En cours'}
                {conv.escalated_at ? ` · escaladée ${timeAgo(conv.escalated_at)}` : ''}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canTake && (
              <button
                onClick={() => doAction('take')}
                className="rounded-full bg-lagoon-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-lagoon-700"
              >
                Prendre en charge
              </button>
            )}
            {!resolved && (
              <>
                <select
                  value=""
                  onChange={(e) => e.target.value && doAction('assign', e.target.value)}
                  className="h-9 max-w-[150px] rounded-full border border-mist-300 bg-white px-3 text-sm text-ink-600"
                  title="Assigner à un agent"
                  aria-label="Assigner à un agent"
                >
                  <option value="">Assigner à…</option>
                  {team.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name ?? t.id}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => doAction('resolve')}
                  className="rounded-full border border-mist-300 bg-white px-3.5 py-1.5 text-sm font-medium text-ink transition hover:border-lagoon-300 hover:text-lagoon-700"
                >
                  Résoudre
                </button>
              </>
            )}
            {resolved && (
              <button
                onClick={() => doAction('reopen')}
                className="rounded-full border border-mist-300 bg-white px-3.5 py-1.5 text-sm font-medium text-ink transition hover:border-lagoon-300"
              >
                Rouvrir
              </button>
            )}
          </div>
        </header>
        {/* Résumé automatique de prise en charge */}
        {conv.summary && (
          <div className="border-b border-aurora-300/50 bg-aurora-100/40 px-5 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-lagoon-700">Résumé — prise en charge</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-ink-700">{conv.summary}</p>
          </div>
        )}
        {/* Fil de messages */}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const newDay = !prev || formatDay(prev.created_at) !== formatDay(m.created_at);
            return (
              <div key={m.id} className="animate-msg-in">
                {newDay && <DayDivider iso={m.created_at} />}
                <MessageRow m={m} feedback={feedback[m.id]} onMakeArticle={openArticleDraft} />
              </div>
            );
          })}
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-400">Aucun message pour le moment.</p>
          )}
          {visitorTyping && (
            <div className="mt-2 flex items-center gap-2 text-xs text-ink-500">
              <TypingDots accent="#0B7A6E" />
              <span>Le visiteur est en train d’écrire…</span>
            </div>
          )}
        </div>
        {/* Copilot IA */}
        {!resolved && (
          <div className="border-t border-mist-300 bg-mist-50 px-4 py-2">
            {!copilotOpen ? (
              <button
                onClick={runCopilot}
                disabled={copilotBusy}
                className="inline-flex items-center gap-1.5 rounded-full border border-aurora-300 bg-white px-3 py-1.5 text-xs font-semibold text-lagoon-700 transition hover:bg-aurora-100/50 disabled:opacity-50"
              >
                ✨ {copilotBusy ? 'Génération…' : 'Suggérer une réponse (IA)'}
              </button>
            ) : (
              <div className="rounded-xl border border-aurora-300 bg-white p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-lagoon-700">
                    Suggestion Copilot
                  </span>
                  <button onClick={() => setCopilotOpen(false)} className="text-xs text-ink-400 hover:text-ink">
                    Masquer
                  </button>
                </div>
                {copilotBusy ? (
                  <p className="py-2 text-sm text-ink-400">Génération de la suggestion…</p>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{copilotText}</p>
                    {copilotSources.length > 0 && (
                      <p className="mt-1.5 text-[11px] text-ink-400">
                        Sources : {copilotSources.map((s) => s.title).join(' · ')}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={insertCopilot}
                        disabled={!copilotText}
                        className="rounded-full bg-lagoon-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-lagoon-700 disabled:opacity-40"
                      >
                        Insérer dans la réponse
                      </button>
                      <button
                        onClick={runCopilot}
                        className="rounded-full border border-mist-300 px-3 py-1.5 text-xs font-medium text-ink-600 transition hover:bg-mist"
                      >
                        Régénérer
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {/* Composeur */}
        <div className={cn('border-t px-4 py-3', noteMode ? 'border-sun-300 bg-sun-50' : 'border-mist-300 bg-white')}>
          {resolved ? (
            <div className="flex items-center justify-center gap-3 py-1 text-sm text-ink-500">
              Conversation résolue.
              <button onClick={() => doAction('reopen')} className="font-medium text-lagoon-600 hover:underline">
                Rouvrir pour continuer
              </button>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-1">
                <button
                  onClick={() => setNoteMode(false)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition',
                    !noteMode ? 'bg-ink text-white' : 'text-ink-500 hover:bg-mist'
                  )}
                >
                  Réponse
                </button>
                <button
                  onClick={() => setNoteMode(true)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition',
                    // sun-600 et non l'ambre DEFAULT : sous du texte blanc,
                    // celui-ci ne donnait que 2,0:1.
                    noteMode ? 'bg-sun-600 text-white' : 'text-ink-500 hover:bg-mist'
                  )}
                >
                  Note interne
                </button>
                {error && <span className="ml-2 text-xs text-coral-600">{error}</span>}
              </div>
              <Composer
                ref={composerRef}
                conversationId={conversationId}
                visitorName={visitor?.display_name ?? 'Visiteur'}
                agentName={agent.full_name ?? ''}
                noteMode={noteMode}
                sending={sending}
                onSubmit={send}
                onTyping={onTyping}
              />
            </>
          )}
        </div>
      </section>
      {/* Contexte visiteur */}
      <aside className="hidden w-[260px] shrink-0 flex-col gap-1 border-l border-mist-300 bg-white p-4 xl:flex">
        <h3 className="mb-2 font-display text-sm font-semibold">Contexte visiteur</h3>
        <dl className="space-y-1">
          {visitor && (
            <>
              <Info label="Première visite" value={new Date(visitor.first_seen_at).toLocaleDateString('fr-FR')} />
              <Info label="Dernière visite" value={timeAgo(visitor.last_seen_at)} />
            </>
          )}
          {conv.source_url && <Info label="Page d’origine" value={conv.source_url} />}
          {conv.os && <Info label="Système" value={conv.os} />}
          {conv.browser && <Info label="Navigateur" value={conv.browser} />}
          {conv.device_type && <Info label="Appareil" value={conv.device_type} />}
          {conv.escalated_at && <Info label="Escaladée" value={timeAgo(conv.escalated_at)} />}
          {conv.summary && <Info label="Résumé" value={conv.summary} />}
        </dl>
      </aside>

      {/* Modale : transformer une réponse en article */}
      {articleDraft && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="article-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setArticleDraft(null);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-panel">
            <h3 id="article-modal-title" className="font-display text-base font-semibold">Nouvel article de la base de connaissances</h3>
            <p className="mt-1 text-xs text-ink-500">
              Vérifiez et ajustez le contenu avant de l’ajouter. Il sera indexé pour le bot.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600">Titre</span>
                <input
                  className="w-full rounded-xl border border-mist-300 px-3.5 py-2.5 text-sm outline-none focus:border-lagoon-400"
                  value={articleDraft.title}
                  onChange={(e) => setArticleDraft({ ...articleDraft, title: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-600">Catégorie</span>
                  <input
                    className="w-full rounded-xl border border-mist-300 px-3.5 py-2.5 text-sm outline-none focus:border-lagoon-400"
                    value={articleDraft.category}
                    onChange={(e) => setArticleDraft({ ...articleDraft, category: e.target.value })}
                    placeholder="Ex. Facturation"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-600">Tags (virgules)</span>
                  <input
                    className="w-full rounded-xl border border-mist-300 px-3.5 py-2.5 text-sm outline-none focus:border-lagoon-400"
                    value={articleDraft.tags}
                    onChange={(e) => setArticleDraft({ ...articleDraft, tags: e.target.value })}
                    placeholder="windows, mobile"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600">Contenu</span>
                <textarea
                  rows={7}
                  className="w-full resize-y rounded-xl border border-mist-300 px-3.5 py-2.5 text-sm outline-none focus:border-lagoon-400"
                  value={articleDraft.content}
                  onChange={(e) => setArticleDraft({ ...articleDraft, content: e.target.value })}
                />
              </label>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setArticleDraft(null)}
                className="rounded-xl border border-mist-300 px-4 py-2 text-sm font-medium text-ink-600 transition hover:bg-mist"
              >
                Annuler
              </button>
              <button
                onClick={saveArticleDraft}
                disabled={sending || !articleDraft.title.trim() || !articleDraft.content.trim()}
                className="rounded-xl bg-lagoon-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-lagoon-700 disabled:opacity-40"
              >
                {sending ? 'Création…' : 'Créer l’article'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Une ligne de message du fil (visiteur, bot, agent, note interne, système). */
function MessageRow({
  m,
  feedback,
  onMakeArticle
}: {
  m: Message;
  feedback?: string;
  onMakeArticle?: (m: Message) => void;
}) {
  if (m.sender === 'system') {
    return <p className="my-2 text-center text-xs italic text-ink-400">{m.content}</p>;
  }
  const isAgent = m.sender === 'agent' && !m.internal_note;
  const isNote = m.internal_note;
  const isBot = m.sender === 'bot';
  return (
    <div className={cn('flex gap-2 py-1', isAgent ? 'justify-end' : 'justify-start')}>
      {isBot && (
        <div className="mt-1">
          <BotOrb size={26} glow={false} />
        </div>
      )}
      {isAgent && <Avatar name={m.agent_name ?? 'Agent'} size={26} className="mt-1" />}
      <div
        className={cn(
          'max-w-[68%] rounded-2xl px-3.5 py-2 text-sm shadow-bubble',
          isAgent && 'rounded-br-sm bg-lagoon-600 text-white',
          isNote && 'rounded-br-sm border border-sun-300 bg-sun-50 text-ink',
          isBot && 'rounded-bl-sm border border-aurora-300/60 bg-aurora-100/60 text-ink',
          m.sender === 'visitor' && 'rounded-bl-sm border border-mist-300 bg-white text-ink'
        )}
      >
        {isNote && (
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-sun-600">Note interne</p>
        )}
        {m.content_html ? (
          <div className="rich-content" dangerouslySetInnerHTML={{ __html: m.content_html }} />
        ) : m.content ? (
          <p className="whitespace-pre-wrap">{m.content}</p>
        ) : null}
        {m.attachments && m.attachments.length > 0 && (
          <AttachmentList attachments={m.attachments} light={isAgent && !isNote} />
        )}
        <div
          className={cn(
            'mt-1 flex items-center gap-2 text-[10px]',
            isAgent && !isNote ? 'text-white/70' : 'text-ink-400'
          )}
        >
          <span>{formatTime(m.created_at)}</span>
          {isBot && feedback === 'up' && <span>👍 utile</span>}
          {isBot && feedback === 'down' && <span className="font-medium text-coral-600">👎 à revoir</span>}
          {isAgent && onMakeArticle && (
            <button
              onClick={() => onMakeArticle(m)}
              className="text-white/80 underline-offset-2 transition hover:text-white hover:underline"
              title="Créer un article de la base de connaissances à partir de cette réponse"
            >
              En faire un article
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Prévisualisation des pièces jointes d'un message (images en vignette, autres en lien). */
function AttachmentList({ attachments, light }: { attachments: Attachment[]; light: boolean }) {
  return (
    <div className={cn('mt-1.5 flex flex-wrap gap-1.5', attachments.length > 0 && 'first:mt-0')}>
      {attachments.map((a) => {
        const isImage = (a.mime_type ?? '').startsWith('image/');
        if (isImage && a.url) {
          return (
            <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={a.url}
                alt={a.file_name ?? 'Pièce jointe'}
                className="max-h-40 max-w-[220px] rounded-lg border border-black/10 object-cover"
              />
            </a>
          );
        }
        return (
          <a
            key={a.id}
            href={a.url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition',
              light ? 'border-white/30 text-white hover:bg-white/10' : 'border-mist-300 text-ink-600 hover:bg-mist'
            )}
          >
            📄 {a.file_name ?? 'Fichier'}
          </a>
        );
      })}
    </div>
  );
}

/** Ligne d'information du panneau contexte. */
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-0.5 break-words text-[13px] text-ink-700">{value}</dd>
    </div>
  );
}