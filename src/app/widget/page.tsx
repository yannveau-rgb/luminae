'use client';

/**
 * Widget de chat public — chargé dans une iframe via /embed.js.
 * Design « Lumen » : orbe lumineux du bot, apparition des messages en
 * élévation, indicateur de frappe à trois points.
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

/** URL de la page hôte : transmise par embed.js (postMessage), sinon referrer. */
function detectPageUrl(): Promise<string> {
  return new Promise((resolve) => {
    const fallback = () => resolve(document.referrer || window.location.href);
    const timer = setTimeout(fallback, 500);
    const onMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === 'luminae:init') {
        clearTimeout(timer);
        window.removeEventListener('message', onMsg);
        resolve(e.data.href || document.referrer || window.location.href);
      }
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

  const tokenRef = useRef<string>(getVisitorToken());
  const contextRef = useRef<VisitorContext>({ url: '', os: '', browser: '', device_type: '' });
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  const scrollBottom = useCallback(() => {
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
  }, []);

  // ── Initialisation : contexte + session ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = await detectPageUrl();
      const device = parseUserAgent(navigator.userAgent);
      contextRef.current = { url, os: device.os, browser: device.browser, device_type: device.device_type };
      try {
        const res = await fetch('/api/widget/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenRef.current, context: contextRef.current })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Session impossible');
        if (cancelled) return;
        setSettings(data.settings);
        setMessages(data.messages ?? []);
        setFeedbacks(data.feedback ?? {});
        if (data.conversation) {
          setConversationId(data.conversation.id);
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

  // ── Temps réel : nouveaux messages, saisie, statut ─────────────────────
  useEffect(() => {
    if (!conversationId) return;
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`conv:${conversationId}`)
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
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, scrollBottom]);

  useEffect(() => {
    if (phase === 'ready') scrollBottom();
  }, [phase, messages.length, scrollBottom]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || sending) return;
      setSending(true);
      setInput('');
      // Nouvelle conversation : on fixe l'id côté client pour s'abonner au canal
      // Realtime AVANT que le bot ne réponde (sinon la 1re réponse serait ratée).
      let convId = conversationId;
      if (!convId) {
        convId = uuid();
        setConversationId(convId);
      }
      const temp: UiMessage = {
        id: `temp-${Date.now()}`,
        sender: 'visitor',
        content: text,
        created_at: new Date().toISOString(),
        temp: true
      };
      setMessages((prev) => [...prev, temp]);
      scrollBottom();
      try {
        const res = await fetch('/api/widget/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: tokenRef.current,
            conversationId: convId,
            content: text,
            context: contextRef.current
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Envoi impossible');
        setConversationId(data.conversationId);
        if (data.status) setStatus(data.status);
        setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...m, failed: false } : m)));
      } catch {
        setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...m, failed: true } : m)));
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending, scrollBottom]
  );

  const vote = useCallback(
    async (messageId: string, value: 'up' | 'down') => {
      if (feedbacks[messageId]) return;
      setFeedbacks((prev) => ({ ...prev, [messageId]: value }));
      try {
        const res = await fetch('/api/widget/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId, value, token: tokenRef.current })
        });
        if (!res.ok) throw new Error();
      } catch {
        setFeedbacks((prev) => {
          const copy = { ...prev };
          delete copy[messageId];
          return copy;
        });
      }
    },
    [feedbacks]
  );

  const askHuman = useCallback(async () => {
    if (!conversationId) {
      await send('Je souhaite parler à un agent, merci.');
      return;
    }
    try {
      const res = await fetch('/api/widget/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenRef.current, conversationId })
      });
      const data = await res.json();
      if (data.status) setStatus(data.status);
    } catch {
      /* le statut sera resynchronisé au prochain message */
    }
  }, [conversationId, send]);

  /** Indicateur de saisie du visiteur, relayé vers les agents (throttlé). */
  const onInput = useCallback(
    (value: string) => {
      setInput(value);
      if (!conversationId) return;
      const now = Date.now();
      if (now - lastTypingSent.current > 1500) {
        lastTypingSent.current = now;
        fetch('/api/widget/typing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, typing: true })
        }).catch(() => {});
      }
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        fetch('/api/widget/typing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, typing: false })
        }).catch(() => {});
      }, 2000);
    },
    [conversationId]
  );

  const accent = settings?.accent_color ?? '#0E8C7D';
  const botName = settings?.bot_name ?? 'Assistant';
  const hasVisitorMessage = messages.some((m) => m.sender === 'visitor');
  const statusLine =
    status === 'bot'
      ? 'En ligne · répond en quelques secondes'
      : status === 'waiting'
        ? 'Vous êtes en file d’attente'
        : status === 'assigned'
          ? 'Un agent vous répond'
          : 'Conversation terminée';

  // ── Rendu ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <main className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-gradient-to-b from-white to-mist">
        <BotOrb size={56} />
        <p className="font-display text-sm font-medium text-ink-600">Connexion à l’assistant…</p>
      </main>
    );
  }

  if (phase === 'error') {
    return (
      <main className="flex h-[100dvh] flex-col items-center justify-center gap-3 bg-gradient-to-b from-white to-mist px-6 text-center">
        <p className="font-display text-base font-semibold text-ink">L’assistant n’a pas pu être chargé.</p>
        <p className="text-sm text-ink-500">Vérifiez votre connexion Internet puis réessayez.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 rounded-full bg-lagoon-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-lagoon-700"
        >
          Réessayer
        </button>
      </main>
    );
  }

  return (
    <main
      className="flex h-[100dvh] flex-col overflow-hidden bg-gradient-to-b from-white to-mist font-sans text-ink"
      style={{ '--accent': accent, '--focus-color': accent } as React.CSSProperties}
    >
      {/* En-tête */}
      <header
        className="px-4 py-3.5 text-white"
        style={{
          background: `linear-gradient(118deg, ${accent}, color-mix(in srgb, ${accent} 55%, #2fc6d4))`
        }}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-full ring-4 ring-white/25">
            <BotOrb size={38} accent="#ffffff" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[15px] font-semibold leading-tight">{botName}</h1>
            <p className="flex items-center gap-1.5 text-[12px] text-white/85">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${status === 'waiting' ? 'bg-sun-300' : 'bg-white'}`}
                aria-hidden
              />
              {statusLine}
            </p>
          </div>
          {status === 'bot' && (
            <button
              onClick={askHuman}
              aria-label="Parler à un humain"
              title="Parler à un humain"
              className="rounded-full bg-white/15 p-2 transition hover:bg-white/30"
            >
              <HumanIcon className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </header>

      {/* Fil de messages */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4" aria-live="polite">
        <div className="space-y-3">
          {messages.length === 0 && settings && (
            <MessageRow bot accent={accent} name={botName}>
              {settings.welcome_message}
            </MessageRow>
          )}

          {messages.map((m) => {
            if (m.sender === 'system') {
              return (
                <div key={m.id} className="animate-fade-in flex justify-center">
                  <span className="rounded-full bg-mist px-3 py-1 text-center text-[12px] text-ink-500">
                    {m.content}
                  </span>
                </div>
              );
            }
            if (m.sender === 'visitor') {
              return (
                <div key={m.id} className="animate-msg-in flex justify-end">
                  <div
                    className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md px-3.5 py-2.5 text-[14px] leading-relaxed text-white shadow-bubble"
                    style={{ background: m.failed ? '#E25C4A' : accent }}
                  >
                    {m.content}
                    {m.failed && <p className="mt-1 text-[11px] text-white/85">Échec de l’envoi — réessayez.</p>}
                  </div>
                </div>
              );
            }
            return (
              <MessageRow key={m.id} bot={m.sender === 'bot'} accent={accent} name={m.agent_name || 'Agent'}>
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
                            className="max-h-40 max-w-[200px] rounded-lg border border-mist-300 object-cover"
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
                  <div className="mt-2 flex items-center gap-1.5 border-t border-mist-300/70 pt-1.5">
                    {feedbacks[m.id] ? (
                      <span className="text-[11.5px] font-medium text-ink-400">Merci pour votre retour !</span>
                    ) : (
                      <>
                        <span className="text-[11.5px] text-ink-400">Utile ?</span>
                        <button
                          onClick={() => vote(m.id, 'up')}
                          aria-label="Cette réponse est utile"
                          className="rounded-full p-1 text-ink-500 transition hover:bg-lagoon-50 hover:text-lagoon-600"
                        >
                          <ThumbIcon up />
                        </button>
                        <button
                          onClick={() => vote(m.id, 'down')}
                          aria-label="Cette réponse n’est pas utile"
                          className="rounded-full p-1 text-ink-500 transition hover:bg-coral-50 hover:text-coral-600"
                        >
                          <ThumbIcon up={false} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </MessageRow>
            );
          })}

          {/* Suggestions (état vide engageant) */}
          {!hasVisitorMessage && settings && settings.suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 pl-9 pt-1">
              {settings.suggestions.map((s) => (
                <SuggestionChip key={s} label={s} onPick={(label) => send(label)} />
              ))}
            </div>
          )}

          {/* Indicateur de frappe */}
          {typingFrom && (
            <div className="animate-msg-in">
              <MessageRow bot={typingFrom === 'bot'} accent={accent} name={typingFrom === 'bot' ? botName : 'Agent'}>
                <TypingDots accent={accent} />
              </MessageRow>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* Composeur */}
      <footer className="border-t border-mist-300 bg-white px-3 pb-2 pt-3">
        {status === 'waiting' && (
          <p className="mb-2 text-center text-[12px] font-medium text-sun-600">
            Un agent va prendre le relais — vous pouvez ajouter des précisions.
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
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
                ? 'Conversation terminée — envoyez un message pour rouvrir'
                : 'Écrivez votre message…'
            }
            aria-label="Votre message"
            className="max-h-32 flex-1 resize-none rounded-xl border border-mist-300 bg-white px-3.5 py-2.5 text-[14px] leading-snug outline-none transition focus:border-lagoon-400"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || sending}
            aria-label="Envoyer le message"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-bubble transition enabled:hover:opacity-90 disabled:opacity-40"
            style={{ background: accent }}
          >
            <SendIcon />
          </button>
        </div>
        {status === 'bot' && (
          <button
            onClick={askHuman}
            className="mx-auto mt-2 flex items-center gap-1.5 text-[12px] font-medium text-ink-400 transition hover:text-ink"
          >
            <HumanIcon className="h-3.5 w-3.5" />
            Parler à un humain
          </button>
        )}
      </footer>
      <p className="bg-white pb-2 text-center text-[10.5px] text-mist-500">
        Propulsé par <span className="font-display font-semibold">Luminae</span>
      </p>
    </main>
  );
}

/** Bulle avec avatar (orbe du bot ou initiales d’agent). */
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
    <div className="animate-msg-in flex items-end gap-2">
      {bot ? <BotOrb size={26} accent={accent} glow={false} /> : <AgentAvatar name={name} size={26} />}
      <div className="max-w-[80%] min-w-0">
        <div className="whitespace-pre-wrap rounded-2xl rounded-bl-md border border-mist-300 bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-ink shadow-bubble">
          {children}
        </div>
      </div>
    </div>
  );
}


