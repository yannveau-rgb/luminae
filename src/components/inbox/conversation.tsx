'use client';

/** Espace de travail de conversation haute performance : fil, actions intelligentes, Copilot RAG et tiroir contexte. */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { BotOrb, TypingDots } from '@/components/widget/parts';
import { cn, formatDay, formatTime, timeAgo } from '@/lib/utils';
import type { Agent, Attachment, Conversation, Message, Visitor } from '@/lib/types';
import { Avatar, DayDivider, StatusBadge } from './parts';
import { Composer, type ComposerHandle, type PendingAttachment } from './composer';
import { playAgentNotificationSound } from '@/lib/browser-notify';

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
  const [realtimeDown, setRealtimeDown] = useState(false);
  const [noteMode, setNoteMode] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(true);

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

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, visitorTyping]);

  // Temps réel conversationnel
  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null;
    let disposed = false;

    const append = (payload: Message) => {
      if (!payload?.id) return;
      setMessages((ms) => {
        if (ms.some((m) => m.id === payload.id)) return ms;
        if (payload.sender === 'visitor') {
          playAgentNotificationSound();
        }
        return [...ms, payload];
      });
    };

    (async () => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken || disposed) return;
      await supabase.realtime.setAuth(accessToken);
      if (disposed) return;

      ch = supabase.channel(`conv:${conversationId}`, { config: { private: true } });
      ch.on('broadcast', { event: 'message:new' }, ({ payload }: { payload: Message }) => {
        if (payload?.internal_note) return;
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

  // Synchronisation continue réactive : garantit la réception instantanée de tous les messages
  // même en cas de coupure passagère ou de veille du navigateur.
  useEffect(() => {
    const id = setInterval(() => {
      load();
    }, 3500);
    return () => clearInterval(id);
  }, [load]);

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
      agent_name: agent.full_name ?? agent.email,
      content: payload.contentHtml.replace(/<[^>]*>/g, ''),
      content_html: payload.contentHtml,
      internal_note: noteMode,
      created_at: new Date().toISOString(),
      attachments: []
    };
    setMessages((ms) => [...ms, optimistic]);

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

  // Copilot IA
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

  // Transformer en article
  function openArticleDraft(agentMessage: Message) {
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
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-xs font-semibold text-coral-600 bg-coral-50 px-4 py-3 rounded-2xl border border-coral-300">
          {error}
        </p>
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
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* ── Section Centrale : Fil de discussion & Composeur ───────────────── */}
      <section className="flex min-w-0 flex-1 flex-col bg-mist">
        {/* En-tête de commande haute précision */}
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-mist-300/80 bg-white px-4 py-3 md:px-6 shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link
              href="/inbox"
              aria-label="Retour"
              className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-ink-500 transition hover:bg-mist md:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>

            <Avatar name={visitor?.display_name ?? 'Visiteur'} size={38} />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-display text-sm font-bold text-ink">
                  {visitor?.display_name ?? 'Visiteur anonyme'}
                </span>
                <StatusBadge status={conv.status} />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-400 mt-0.5">
                <span>
                  {assignedName ? `Assignée à ${assignedName}` : canTake ? 'Non assignée' : 'En cours'}
                  {conv.escalated_at ? ` · escaladée ${timeAgo(conv.escalated_at)}` : ''}
                </span>
                {(conv.os || conv.browser) && (
                  <span className="rounded bg-mist-200 px-1.5 py-0.2 text-[10px] text-ink-600 font-mono">
                    {conv.os} · {conv.browser}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Cluster d'actions rapides */}
          <div className="flex shrink-0 items-center gap-2">
            {canTake && (
              <button
                onClick={() => doAction('take')}
                className="flex items-center gap-1.5 rounded-xl bg-lagoon-600 px-3.5 py-2 text-xs font-semibold text-white shadow-glow-sm transition hover:bg-lagoon-500"
              >
                <span>⚡</span>
                <span>Prendre en charge</span>
              </button>
            )}

            {!resolved ? (
              <>
                <select
                  value=""
                  onChange={(e) => e.target.value && doAction('assign', e.target.value)}
                  className="rounded-xl border border-mist-300 bg-white px-3 py-2 text-xs text-ink-600 outline-none hover:border-lagoon-400 transition"
                  title="Assigner"
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
                  className="flex items-center gap-1 rounded-xl border border-mist-300 bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:border-lagoon-300 hover:text-lagoon-700 hover:bg-lagoon-50/50"
                >
                  <span>✓</span>
                  <span>Résoudre</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => doAction('reopen')}
                className="rounded-xl border border-mist-300 bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:border-lagoon-300"
              >
                Rouvrir
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowDrawer(!showDrawer)}
              className={cn(
                'hidden xl:flex h-8 w-8 items-center justify-center rounded-xl border transition',
                showDrawer
                  ? 'border-lagoon-300 bg-lagoon-50 text-lagoon-700'
                  : 'border-mist-300 bg-white text-ink-400 hover:text-ink'
              )}
              title="Afficher/Masquer le contexte client"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </button>
          </div>
        </header>

        {/* Résumé automatique de prise en charge */}
        {conv.summary && (
          <div className="flex items-start gap-2.5 border-b border-aurora-300/60 bg-gradient-to-r from-aurora-100/50 to-white px-5 py-2.5">
            <span className="text-sm">✨</span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-lagoon-700">
                Résumé d&apos;escalade IA
              </p>
              <p className="text-xs leading-relaxed text-ink-700 mt-0.5">{conv.summary}</p>
            </div>
          </div>
        )}

        {/* Fil de discussion */}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-2">
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
            <p className="py-12 text-center text-xs text-ink-400">Aucun message pour le moment.</p>
          )}

          {visitorTyping && (
            <div className="flex items-center gap-2 pt-2 text-xs text-ink-500">
              <TypingDots accent="#0B7A6E" />
              <span className="italic">Le visiteur est en train d’écrire…</span>
            </div>
          )}
        </div>

        {/* Dock d'assistance Copilot IA */}
        {!resolved && (
          <div className="border-t border-mist-300/80 bg-gradient-to-b from-mist-50 to-white px-4 py-2.5">
            {!copilotOpen ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={runCopilot}
                  disabled={copilotBusy}
                  className="inline-flex items-center gap-2 rounded-xl border border-aurora-300 bg-white px-3.5 py-2 text-xs font-semibold text-lagoon-700 shadow-sm transition hover:bg-aurora-100/50 hover:shadow-glow-sm disabled:opacity-50"
                >
                  <span>✨</span>
                  <span>{copilotBusy ? 'Génération en cours…' : 'Suggérer une réponse Copilot (RAG)'}</span>
                </button>
              </div>
            ) : (
              <div className="animate-slide-up rounded-2xl border border-aurora-300/80 bg-white p-4 shadow-glow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-aurora-100 text-xs">
                      ✨
                    </span>
                    <span className="font-display text-xs font-bold uppercase tracking-wider text-lagoon-700">
                      Copilot Luminae · RAG Mistral
                    </span>
                  </div>
                  <button
                    onClick={() => setCopilotOpen(false)}
                    className="rounded-lg p-1 text-xs text-ink-400 hover:bg-mist hover:text-ink"
                  >
                    Masquer
                  </button>
                </div>

                {copilotBusy ? (
                  <div className="flex items-center gap-2 py-3 text-xs text-ink-500">
                    <TypingDots accent="#0B7A6E" />
                    <span>L&apos;IA analyse la conversation et extrait les articles pertinents…</span>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap rounded-xl bg-mist-50 p-3.5 text-xs leading-relaxed text-ink-800 border border-mist-200">
                      {copilotText}
                    </p>

                    {copilotSources.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                        <span className="text-[10.5px] font-semibold uppercase text-ink-400">Sources :</span>
                        {copilotSources.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-mist-300 bg-white px-2 py-0.5 text-[11px] text-ink-700 shadow-sm font-medium"
                          >
                            📖 {s.title}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3.5 flex items-center gap-2">
                      <button
                        onClick={insertCopilot}
                        disabled={!copilotText}
                        className="rounded-xl bg-lagoon-600 px-4 py-2 text-xs font-semibold text-white shadow-glow-sm transition hover:bg-lagoon-500 disabled:opacity-40"
                      >
                        Insérer dans l&apos;éditeur &rarr;
                      </button>
                      <button
                        onClick={runCopilot}
                        className="rounded-xl border border-mist-300 bg-white px-3.5 py-2 text-xs font-medium text-ink-600 transition hover:bg-mist"
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

        {/* Composeur de message */}
        <div
          className={cn(
            'border-t px-4 py-3 transition-colors',
            noteMode ? 'border-sun-300 bg-sun-50/70' : 'border-mist-300 bg-white'
          )}
        >
          {resolved ? (
            <div className="flex items-center justify-center gap-3 py-2 text-xs text-ink-500">
              <span>Conversation résolue.</span>
              <button
                onClick={() => doAction('reopen')}
                className="font-semibold text-lagoon-600 hover:underline"
              >
                Rouvrir pour répondre
              </button>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-1.5">
                <button
                  onClick={() => setNoteMode(false)}
                  className={cn(
                    'rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                    !noteMode ? 'bg-ink text-white shadow-sm' : 'text-ink-500 hover:bg-mist'
                  )}
                >
                  Répondre au client
                </button>
                <button
                  onClick={() => setNoteMode(true)}
                  className={cn(
                    'flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                    noteMode ? 'bg-sun-600 text-white shadow-sm' : 'text-ink-500 hover:bg-mist'
                  )}
                >
                  <span>🔒</span>
                  <span>Note interne (équipe)</span>
                </button>
                {error && <span className="ml-2 text-xs text-coral-600 font-medium">{error}</span>}
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

      {/* ── Tiroir Latéral Droit : Contexte Client & Intelligence ────────────── */}
      {showDrawer && (
        <aside className="hidden w-[280px] shrink-0 flex-col border-l border-mist-300/80 bg-white p-5 xl:flex overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-mist-300/60">
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink">Contexte Visiteur</h3>
            <span className="h-2 w-2 rounded-full bg-lagoon-500 animate-pulse" title="En ligne" />
          </div>

          <dl className="mt-4 space-y-3.5">
            {visitor && (
              <>
                <Info label="Première visite" value={new Date(visitor.first_seen_at).toLocaleDateString('fr-FR')} />
                <Info label="Dernière activité" value={timeAgo(visitor.last_seen_at)} />
              </>
            )}
            {conv.source_url && <Info label="Page d’origine" value={conv.source_url} isLink />}
            {conv.os && <Info label="Système d'exploitation" value={conv.os} />}
            {conv.browser && <Info label="Navigateur" value={conv.browser} />}
            {conv.device_type && <Info label="Type d'appareil" value={conv.device_type} />}
            {conv.escalated_at && <Info label="Escaladée" value={timeAgo(conv.escalated_at)} />}
          </dl>
        </aside>
      )}

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
          <div className="w-full max-w-lg animate-slide-up rounded-2xl bg-white p-6 shadow-panel">
            <h3 id="article-modal-title" className="font-display text-base font-bold text-ink">
              Créer un article de connaissances (RAG)
            </h3>
            <p className="mt-1 text-xs text-ink-500">
              Cet article sera automatiquement vectorisé et utilisé par le bot pour répondre aux questions similaires.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600">Titre de l&apos;article</span>
                <input
                  className="w-full rounded-xl border border-mist-300 px-3.5 py-2.5 text-xs outline-none focus:border-lagoon-400"
                  value={articleDraft.title}
                  onChange={(e) => setArticleDraft({ ...articleDraft, title: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-600">Catégorie</span>
                  <input
                    className="w-full rounded-xl border border-mist-300 px-3.5 py-2.5 text-xs outline-none focus:border-lagoon-400"
                    value={articleDraft.category}
                    onChange={(e) => setArticleDraft({ ...articleDraft, category: e.target.value })}
                    placeholder="Ex. Facturation"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-600">Tags contextuels</span>
                  <input
                    className="w-full rounded-xl border border-mist-300 px-3.5 py-2.5 text-xs outline-none focus:border-lagoon-400"
                    value={articleDraft.tags}
                    onChange={(e) => setArticleDraft({ ...articleDraft, tags: e.target.value })}
                    placeholder="windows, safari"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600">Contenu de la solution</span>
                <textarea
                  rows={6}
                  className="w-full resize-y rounded-xl border border-mist-300 px-3.5 py-2.5 text-xs leading-relaxed outline-none focus:border-lagoon-400 font-sans"
                  value={articleDraft.content}
                  onChange={(e) => setArticleDraft({ ...articleDraft, content: e.target.value })}
                />
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-mist-300/60 pt-4">
              <button
                onClick={() => setArticleDraft(null)}
                className="rounded-xl border border-mist-300 px-4 py-2 text-xs font-semibold text-ink-600 hover:bg-mist"
              >
                Annuler
              </button>
              <button
                onClick={saveArticleDraft}
                disabled={sending || !articleDraft.title.trim() || !articleDraft.content.trim()}
                className="rounded-xl bg-lagoon-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-lagoon-500 disabled:opacity-40 shadow-glow-sm"
              >
                {sending ? 'Indexation en cours…' : 'Enregistrer et indexer dans le RAG'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Ligne de message du fil avec identité nette et micro-actions. */
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
    const isNav = m.content.startsWith('🧭');
    return (
      <div className="my-2.5 flex justify-center">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-medium shadow-sm transition',
            isNav
              ? 'border border-lagoon-300/80 bg-lagoon-50 text-lagoon-700 font-semibold'
              : 'border border-mist-300 bg-white text-ink-500'
          )}
        >
          {m.content}
        </span>
      </div>
    );
  }

  const isAgent = m.sender === 'agent' && !m.internal_note;
  const isNote = m.internal_note;
  const isBot = m.sender === 'bot';

  return (
    <div className={cn('flex gap-2.5 py-1', isAgent ? 'justify-end' : 'justify-start')}>
      {isBot && (
        <div className="mt-0.5 shrink-0">
          <BotOrb size={28} glow={false} />
        </div>
      )}

      {isAgent && <Avatar name={m.agent_name ?? 'Agent'} size={28} className="mt-0.5 shrink-0" />}

      <div
        className={cn(
          'group relative max-w-[72%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-bubble',
          isAgent && 'rounded-br-sm bg-lagoon-600 text-white',
          isNote && 'rounded-br-sm border border-sun-300/80 bg-sun-50 text-ink shadow-sm',
          isBot && 'rounded-bl-sm border border-aurora-300/70 bg-white text-ink shadow-sm',
          m.sender === 'visitor' && 'rounded-bl-sm border border-mist-300 bg-white text-ink'
        )}
      >
        {isNote && (
          <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sun-700">
            <span>🔒</span>
            <span>Note interne d&apos;équipe</span>
          </div>
        )}

        {isBot && (
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-aurora-600">
            Assistant RAG Luminae
          </div>
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
            'mt-1.5 flex items-center gap-2 text-[10px]',
            isAgent && !isNote ? 'text-white/75' : 'text-ink-400'
          )}
        >
          <span>{formatTime(m.created_at)}</span>
          {isBot && feedback === 'up' && <span className="font-semibold text-lagoon-600">👍 utile</span>}
          {isBot && feedback === 'down' && <span className="font-semibold text-coral-600">👎 à revoir</span>}

          {isAgent && onMakeArticle && (
            <button
              onClick={() => onMakeArticle(m)}
              className="ml-auto opacity-0 group-hover:opacity-100 text-white/90 underline-offset-2 transition hover:text-white hover:underline"
              title="Indexer cette solution dans la base RAG"
            >
              + En faire un article RAG
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AttachmentList({ attachments, light }: { attachments: Attachment[]; light: boolean }) {
  return (
    <div className={cn('mt-2 flex flex-wrap gap-1.5', attachments.length > 0 && 'first:mt-0')}>
      {attachments.map((a) => {
        const isImage = (a.mime_type ?? '').startsWith('image/');
        if (isImage && a.url) {
          return (
            <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={a.url}
                alt={a.file_name ?? 'Pièce jointe'}
                className="max-h-40 max-w-[220px] rounded-xl border border-black/10 object-cover"
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
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition',
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

function Info({ label, value, isLink }: { label: string; value: string; isLink?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{label}</dt>
      <dd className="mt-0.5 break-words text-xs font-medium text-ink-700">
        {isLink ? (
          <a href={value} target="_blank" rel="noreferrer" className="text-lagoon-600 hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}