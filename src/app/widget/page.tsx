'use client';

/**
 * Widget de chat public haute performance — chargé dans une iframe ou en direct.
 * Ambiance Luminae « Lumen » : orbe lumineux, accueil interactif, bulles dépolies, RAG et escalade fluide.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { parseUserAgent } from '@/lib/device';
import type { VisitorContext, WidgetSettings } from '@/lib/types';
import {
  AgentAvatar,
  BotOrb,
  HumanIcon,
  SendIcon,
  SuggestionChip,
  ThumbIcon,
  TypingDots
} from '@/components/widget/parts';

interface UiAttachment {
  id: string;
  url: string | null;
  file_name: string | null;
  mime_type: string | null;
}

interface UiMessage {
  id: string;
  sender: 'visitor' | 'bot' | 'agent' | 'system';
  content: string;
  content_html?: string | null;
  created_at: string;
  agent_name?: string | null;
  attachments?: UiAttachment[];
  temp?: boolean;
  failed?: boolean;
}

type Status = 'bot' | 'waiting' | 'assigned' | 'resolved';

const TOKEN_KEY = 'luminae_visitor_token';

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getVisitorToken(): string {
  try {
    let t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      t = uuid();
      localStorage.setItem(TOKEN_KEY, t);
    }
    return t;
  } catch {
    return uuid();
  }
}

function claimedUrlFrom(event: MessageEvent): string | null {
  if (!event.data || event.data.type !== 'luminae:init') return null;
  const href = typeof event.data.href === 'string' ? event.data.href : '';
  if (!href) return null;

  const claimed = new URL(href);
  if (claimed.protocol !== 'http:' && claimed.protocol !== 'https:') return null;
  if (event.origin === 'null' || claimed.origin !== event.origin) return null;

  return href;
}

function detectPageUrl(): Promise<string> {
  return new Promise((resolve) => {
    const fallback = () => resolve(document.referrer || window.location.href);
    const timer = setTimeout(fallback, 500);
    const onMsg = (e: MessageEvent) => {
      let href: string | null = null;
      try {
        href = claimedUrlFrom(e);
      } catch {
        href = null;
      }
      if (!href) return;
      clearTimeout(timer);
      window.removeEventListener('message', onMsg);
      resolve(href);
    };
    window.addEventListener('message', onMsg);
  });
}

export default function WidgetPage() {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [settings, setSettings] = useState<WidgetSettings | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('bot');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [feedbacks, setFeedbacks] = useState<Record<string, 'up' | 'down'>>({});
  const [typingFrom, setTypingFrom] = useState<'bot' | 'agent' | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [visitorName, setVisitorName] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [nameDismissed, setNameDismissed] = useState(false);
  const [erasing, setErasing] = useState(false);

  const tokenRef = useRef<string>(getVisitorToken());
  const accessTokenRef = useRef<string | null>(null);
  const contextRef = useRef<VisitorContext>({ url: '', os: '', browser: '', device_type: '' });
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  const scrollBottom = useCallback(() => {
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
  }, []);

  const refreshMessages = useCallback(async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessTokenRef.current) {
      headers['Authorization'] = `Bearer ${accessTokenRef.current}`;
    }
    try {
      const res = await fetch('/api/widget/session', {
        method: 'POST',
        headers,
        body: JSON.stringify({ token: tokenRef.current, context: contextRef.current })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.messages) setMessages(data.messages);
        if (data.feedback) setFeedbacks(data.feedback);
        if (data.conversation?.status) setStatus(data.conversation.status);
      }
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = await detectPageUrl();
      const device = parseUserAgent(navigator.userAgent);
      contextRef.current = { url, os: device.os, browser: device.browser, device_type: device.device_type };

      const supabase = supabaseBrowser();
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        const { data } = await supabase.auth.signInAnonymously().catch(() => ({ data: { session: null } }));
        session = data?.session ?? null;
      }

      if (session?.access_token) {
        accessTokenRef.current = session.access_token;
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      try {
        const res = await fetch('/api/widget/session', {
          method: 'POST',
          headers,
          body: JSON.stringify({ token: tokenRef.current, context: contextRef.current })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Session impossible');
        if (cancelled) return;
        setSettings(data.settings);
        setMessages(data.messages ?? []);
        setFeedbacks(data.feedback ?? {});
        if (data.conversationId) setConversationId(data.conversationId);
        setVisitorName(data.visitorName ?? null);
        if (data.conversation) {
          setConversationStarted(true);
          setStatus(data.conversation.status);
        }
        setPhase('ready');
      } catch {
        if (!cancelled) setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Temps réel conversationnel avec écoute privée et token
  useEffect(() => {
    if (!conversationId) return;
    const supabase = supabaseBrowser();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let disposed = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (accessToken) {
        accessTokenRef.current = accessToken;
        await supabase.realtime.setAuth(accessToken);
      }
      if (disposed) return;
      channel = supabase
        .channel(`conv:${conversationId}`, { config: { private: true } })
        .on('broadcast', { event: 'message:new' }, ({ payload }: { payload: any }) => {
          const msg = payload as UiMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            if (msg.sender === 'visitor') {
              const idx = prev.findIndex((m) => m.temp && m.content === msg.content);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = msg;
                return copy;
              }
            }
            return [...prev, msg];
          });
          setTypingFrom(null);
          scrollBottom();
        })
        .on('broadcast', { event: 'typing' }, ({ payload }: { payload: any }) => {
          const p = payload as { from: string; on: boolean };
          if (p.from !== 'visitor') setTypingFrom(p.on ? (p.from === 'agent' ? 'agent' : 'bot') : null);
        })
        .on('broadcast', { event: 'conversation:update' }, ({ payload }: { payload: any }) => {
          const p = payload as { status?: Status };
          if (p.status) setStatus(p.status);
        })
        .subscribe();
    })();

    return () => {
      disposed = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversationId, scrollBottom]);

  // Synchronisation continue réactive : garantit la réception des réponses humaines et du bot
  useEffect(() => {
    if (phase !== 'ready') return;
    // Si la conversation est active et attend une réponse humaine ou a démarré, synchroniser périodiquement
    const intervalTime = status === 'waiting' || status === 'assigned' ? 3000 : 8000;
    const timer = setInterval(() => {
      refreshMessages();
    }, intervalTime);
    return () => clearInterval(timer);
  }, [phase, status, refreshMessages]);

  useEffect(() => {
    if (phase === 'ready') scrollBottom();
  }, [phase, messages.length, scrollBottom]);

  async function send(content: string) {
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    const tempId = `tmp-${Date.now()}`;
    const optimistic: UiMessage = {
      id: tempId,
      sender: 'visitor',
      content: text,
      created_at: new Date().toISOString(),
      temp: true
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollBottom();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessTokenRef.current) {
      headers['Authorization'] = `Bearer ${accessTokenRef.current}`;
    }

    try {
      const res = await fetch('/api/widget/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          conversationId,
          content: text,
          token: tokenRef.current,
          context: contextRef.current
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
      }
      if (data.status) {
        setStatus(data.status);
      }
      if (Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages(data.messages);
      }
      setConversationStarted(true);
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, failed: true } : m)));
    } finally {
      setSending(false);
    }
  }

  async function askHuman() {
    if (!conversationId) return;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessTokenRef.current) {
      headers['Authorization'] = `Bearer ${accessTokenRef.current}`;
    }
    try {
      const res = await fetch('/api/widget/escalate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ conversationId, token: tokenRef.current })
      });
      if (res.ok) {
        setStatus('waiting');
      }
    } catch {}
  }

  async function vote(messageId: string, value: 'up' | 'down') {
    setFeedbacks((prev) => ({ ...prev, [messageId]: value }));
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessTokenRef.current) {
      headers['Authorization'] = `Bearer ${accessTokenRef.current}`;
    }
    fetch('/api/widget/feedback', {
      method: 'POST',
      headers,
      body: JSON.stringify({ messageId, value, token: tokenRef.current })
    }).catch(() => {});
  }

  async function submitName() {
    const n = nameDraft.trim();
    if (!n) return;
    setVisitorName(n);
    setNameDraft('');
    fetch('/api/widget/visitor-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n, token: tokenRef.current })
    }).catch(() => {});
  }

  async function eraseData() {
    if (erasing) return;
    if (!window.confirm('Voulez-vous vraiment effacer l’ensemble de vos conversations ? Cette action est irréversible.')) {
      return;
    }
    setErasing(true);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessTokenRef.current) {
      headers['Authorization'] = `Bearer ${accessTokenRef.current}`;
    }
    try {
      await fetch('/api/widget/erase', {
        method: 'POST',
        headers,
        body: JSON.stringify({ token: tokenRef.current })
      });
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {}
      window.location.reload();
    } catch {
      setErasing(false);
    }
  }

  const onInput = useCallback(
    (val: string) => {
      setInput(val);
      if (!conversationId || !conversationStarted) return;
      const ping = (typing: boolean) =>
        fetch('/api/widget/typing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, typing, token: tokenRef.current })
        }).catch(() => {});

      const now = Date.now();
      if (now - lastTypingSent.current > 1500) {
        lastTypingSent.current = now;
        ping(true);
      }
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => ping(false), 2000);
    },
    [conversationId, conversationStarted]
  );

  const accent = settings?.accent_color ?? '#0B7A6E';
  const botName = settings?.bot_name ?? 'Assistant Luminae';
  const hasVisitorMessage = messages.some((m) => m.sender === 'visitor');

  const statusLine =
    status === 'bot'
      ? 'Assistant IA · Réponse instantanée'
      : status === 'waiting'
        ? 'Conseiller notifié · En attente'
        : status === 'assigned'
          ? 'Conseiller en ligne'
          : 'Conversation terminée';

  if (phase === 'loading') {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center bg-mist-100 p-0 sm:p-4">
        <main className="flex h-[100dvh] w-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-white to-mist sm:h-[680px] sm:max-w-[420px] sm:rounded-3xl sm:border sm:border-mist-300/80 sm:shadow-2xl">
          <BotOrb size={56} />
          <p className="font-display text-xs font-semibold text-ink-600">Connexion à Luminae…</p>
        </main>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center bg-mist-100 p-0 sm:p-4">
        <main className="flex h-[100dvh] w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-white to-mist px-6 text-center sm:h-[680px] sm:max-w-[420px] sm:rounded-3xl sm:border sm:border-mist-300/80 sm:shadow-2xl">
          <p className="font-display text-sm font-bold text-ink">L’assistant n’a pas pu être chargé.</p>
          <p className="text-xs text-ink-500">Vérifiez votre connexion Internet puis réessayez.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 rounded-xl bg-lagoon-600 px-5 py-2.5 text-xs font-semibold text-white shadow-glow-sm transition hover:bg-lagoon-500"
          >
            Réessayer
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center bg-mist-100 p-0 sm:p-4 md:p-6">
      <main
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-gradient-to-b from-white via-mist-50 to-mist font-sans text-ink sm:h-[700px] sm:max-w-[420px] sm:rounded-3xl sm:border sm:border-mist-300/80 sm:shadow-2xl sm:ring-1 sm:ring-black/5"
        style={{ '--accent': accent, '--focus-color': accent } as React.CSSProperties}
      >
      {/* ── En-tête haut de gamme en verre dépoli ────────────────────────────── */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-mist-300/80 bg-white/90 px-4 py-3.5 backdrop-blur-md shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          {status === 'bot' ? (
            <BotOrb size={36} accent={accent} glow={typingFrom === 'bot'} />
          ) : (
            <AgentAvatar name={botName} size={36} />
          )}
          <div className="min-w-0">
            <h1 className="truncate font-display text-sm font-bold tracking-tight text-ink">{botName}</h1>
            <p className="flex items-center gap-1.5 text-[11px] text-ink-500 font-medium">
              <span
                className={`h-2 w-2 rounded-full ${
                  status === 'bot' ? 'bg-aurora-500 animate-pulse' : 'bg-lagoon-500'
                }`}
                aria-hidden
              />
              {statusLine}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {status === 'bot' && (
            <button
              onClick={askHuman}
              aria-label="Parler à un conseiller humain"
              title="Demander un conseiller humain"
              className="flex items-center gap-1.5 rounded-xl border border-mist-300 bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-sm transition hover:border-lagoon-300 hover:bg-lagoon-50 hover:text-lagoon-700"
            >
              <HumanIcon className="h-3.5 w-3.5 text-lagoon-600" />
              <span>Humain</span>
            </button>
          )}

          <button
            onClick={() => window.location.reload()}
            aria-label="Recommencer la conversation"
            title="Recommencer"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-400 transition hover:bg-mist hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Fil de messages & Accueil ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        <div className="space-y-3.5">
          {/* Carte d'accueil engageante si premier contact */}
          {!hasVisitorMessage && settings && (
            <div className="animate-fade-in my-2 rounded-2xl border border-aurora-300/80 bg-white p-4 shadow-sm text-center">
              <div className="flex justify-center mb-2">
                <BotOrb size={44} accent={accent} glow />
              </div>
              <h2 className="font-display text-sm font-bold text-ink">Bienvenue sur notre support en direct</h2>
              <p className="mt-1 text-xs text-ink-600 leading-relaxed max-w-xs mx-auto">
                {settings.welcome_message}
              </p>
              <div className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-lagoon-50 px-2.5 py-0.5 text-[10.5px] font-semibold text-lagoon-700">
                <span className="h-1.5 w-1.5 rounded-full bg-lagoon-500 animate-pulse" />
                <span>Temps de réponse moyen : 10 secondes</span>
              </div>
            </div>
          )}

          {/* Suggestions de questions rapides */}
          {!hasVisitorMessage && settings && settings.suggestions.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 px-1">Questions fréquentes :</p>
              <div className="flex flex-col gap-2">
                {settings.suggestions.map((s, idx) => (
                  <SuggestionChip
                    key={s}
                    label={s}
                    icon={idx === 0 ? '✨' : idx === 1 ? '💳' : '⚡'}
                    onPick={(label) => send(label)}
                  />
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            if (m.sender === 'system') {
              return (
                <div key={m.id} className="animate-fade-in flex justify-center my-2">
                  <span className="rounded-full bg-mist-200/80 px-3 py-1 text-center text-[11px] font-medium text-ink-500">
                    {m.content}
                  </span>
                </div>
              );
            }

            if (m.sender === 'visitor') {
              return (
                <div key={m.id} className="animate-msg-in flex justify-end">
                  <div
                    className="max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-br-sm px-4 py-2.5 text-xs leading-relaxed text-white shadow-bubble font-medium"
                    style={{ background: m.failed ? '#E25C4A' : accent }}
                  >
                    {m.content}
                    {m.failed && <p className="mt-1 text-[10.5px] text-white/85">Échec de l’envoi — réessayez.</p>}
                  </div>
                </div>
              );
            }

            return (
              <MessageRow key={m.id} bot={m.sender === 'bot'} accent={accent} name={m.agent_name || 'Conseiller'}>
                {m.content_html ? (
                  <div className="rich-content" dangerouslySetInnerHTML={{ __html: m.content_html }} />
                ) : (
                  m.content
                )}

                {m.attachments && m.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.attachments.map((a) =>
                      (a.mime_type ?? '').startsWith('image/') && a.url ? (
                        <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={a.url}
                            alt={a.file_name ?? 'Pièce jointe'}
                            className="max-h-40 max-w-[200px] rounded-xl border border-mist-300 object-cover"
                          />
                        </a>
                      ) : (
                        <a
                          key={a.id}
                          href={a.url ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-mist-300 px-2.5 py-1.5 text-xs text-ink-600 transition hover:bg-mist"
                        >
                          📄 {a.file_name ?? 'Fichier'}
                        </a>
                      )
                    )}
                  </div>
                )}

                {m.sender === 'bot' && (
                  <div className="mt-2.5 flex items-center justify-between border-t border-mist-200/80 pt-2 text-[11px] text-ink-400">
                    <span className="text-[10px] font-semibold text-aurora-600">RAG Luminae</span>
                    <div className="flex items-center gap-1.5">
                      {feedbacks[m.id] ? (
                        <span className="font-semibold text-lagoon-600">Merci pour votre retour !</span>
                      ) : (
                        <>
                          <span>Utile ?</span>
                          <button
                            onClick={() => vote(m.id, 'up')}
                            aria-label="Cette réponse est utile"
                            className="rounded-lg p-1 text-ink-400 transition hover:bg-lagoon-50 hover:text-lagoon-600"
                          >
                            <ThumbIcon up />
                          </button>
                          <button
                            onClick={() => vote(m.id, 'down')}
                            aria-label="Cette réponse n’est pas utile"
                            className="rounded-lg p-1 text-ink-400 transition hover:bg-coral-50 hover:text-coral-600"
                          >
                            <ThumbIcon up={false} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </MessageRow>
            );
          })}

          {/* Indicateur de frappe */}
          {typingFrom && (
            <div className="animate-msg-in">
              <MessageRow bot={typingFrom === 'bot'} accent={accent} name={typingFrom === 'bot' ? botName : 'Conseiller'}>
                <TypingDots accent={accent} />
              </MessageRow>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* ── Composeur flottant ────────────────────────────────────────────── */}
      <footer className="border-t border-mist-300/80 bg-white/95 px-3.5 pb-2.5 pt-3 backdrop-blur-md">
        {status === 'waiting' && (
          <p className="mb-2 text-center text-xs font-semibold text-sun-600 animate-pulse">
            Un conseiller prépare sa réponse — vous pouvez ajouter des précisions ci-dessous.
          </p>
        )}

        {(status === 'waiting' || status === 'assigned') && !visitorName && !nameDismissed && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitName();
            }}
            className="mb-2.5 animate-slide-up rounded-xl border border-lagoon-300 bg-lagoon-50/70 p-3 shadow-sm"
          >
            <label htmlFor="luminae-prenom" className="block text-xs font-semibold text-lagoon-700">
              Quel est votre prénom ? (pour personnaliser l&apos;échange)
            </label>
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                id="luminae-prenom"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={60}
                autoComplete="given-name"
                placeholder="Ex. Sophie"
                className="min-w-0 flex-1 rounded-xl border border-mist-300 bg-white px-3 py-1.5 text-xs outline-none transition focus:border-lagoon-400"
              />
              <button
                type="submit"
                disabled={!nameDraft.trim()}
                className="shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-white transition disabled:opacity-40 shadow-glow-sm"
                style={{ background: accent }}
              >
                Valider
              </button>
              <button
                type="button"
                onClick={() => setNameDismissed(true)}
                className="shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-medium text-ink-500 hover:bg-mist"
              >
                Plus tard
              </button>
            </div>
          </form>
        )}

        <div className="flex items-end gap-2">
          <div className="relative min-w-0 flex-1">
            <textarea
              value={input}
              maxLength={2000}
              onChange={(e) => onInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={Math.min(4, Math.max(1, input.split('\n').length))}
              placeholder={
                status === 'resolved'
                  ? 'Conversation terminée — écrivez pour rouvrir'
                  : 'Écrivez votre message…'
              }
              aria-label="Votre message"
              className="max-h-32 w-full resize-none rounded-xl border border-mist-300 bg-mist-50/50 px-3.5 py-2.5 text-xs leading-relaxed text-ink outline-none transition focus:border-lagoon-400 focus:bg-white focus:ring-2 focus:ring-lagoon-400/20"
            />
            {input.length >= 1500 && (
              <span
                className={`absolute bottom-2 right-2 rounded px-1.5 py-0.5 text-[9.5px] font-medium ${
                  input.length >= 1950 ? 'bg-coral-50 text-coral-600' : 'bg-mist text-ink-500'
                }`}
              >
                {input.length}/2000
              </span>
            )}
          </div>

          <button
            onClick={() => send(input)}
            disabled={!input.trim() || sending}
            aria-label="Envoyer le message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-bubble transition hover:opacity-90 disabled:opacity-40"
            style={{ background: accent }}
          >
            <SendIcon className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-1 text-center text-[10px] text-ink-400 font-medium">
          Entrée pour envoyer · Maj+Entrée pour retour ligne
        </p>
      </footer>

      {/* ── Pied de page légal et droit à l'effacement ──────────────────────── */}
      <div className="bg-white px-3 pb-2 text-center text-[10px] text-ink-400 border-t border-mist-200/60">
        <p>
          Propulsé par <span className="font-display font-bold text-ink-700">Luminae</span> · IA souveraine Mistral (UE)
        </p>
        <p className="mt-0.5">
          {settings?.privacy_url && (
            <>
              <a
                href={settings.privacy_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-ink font-medium"
              >
                Confidentialité
              </a>
              <span aria-hidden> · </span>
            </>
          )}
          <button
            type="button"
            onClick={eraseData}
            className="underline underline-offset-2 hover:text-ink font-medium"
          >
            {erasing ? 'Suppression…' : 'Supprimer mes données'}
          </button>
        </p>
      </div>
    </main>
    </div>
  );
}

/** Bulle avec avatar et ombre douce. */
function MessageRow({
  bot,
  accent,
  name,
  children
}: {
  bot: boolean;
  accent: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-msg-in flex items-end gap-2.5">
      {bot ? <BotOrb size={28} accent={accent} glow={false} /> : <AgentAvatar name={name} size={28} />}
      <div className="max-w-[82%] min-w-0">
        <div className="whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-mist-300/80 bg-white p-3.5 text-xs leading-relaxed text-ink shadow-bubble">
          {children}
        </div>
      </div>
    </div>
  );
}
