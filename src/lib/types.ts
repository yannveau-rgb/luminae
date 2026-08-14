// Types partagés de Luminae (miroir du schéma Postgres).

export type ConversationStatus = 'bot' | 'waiting' | 'assigned' | 'resolved';
export type MessageSender = 'visitor' | 'bot' | 'agent' | 'system';
export type AgentRole = 'admin' | 'agent';
export type CannedVisibility = 'personal' | 'shared';
export type FeedbackValue = 'up' | 'down';

export interface NotificationPrefs {
  assigned: boolean;
  new_message: boolean;
  mention: boolean;
}

export interface Agent {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string | null;
  role: AgentRole;
  avatar_url: string | null;
  notification_prefs: NotificationPrefs;
  silent_mode: boolean;
  created_at: string;
}

export interface Visitor {
  id: string;
  token: string;
  display_name: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface Conversation {
  id: string;
  visitor_id: string;
  status: ConversationStatus;
  assigned_agent_id: string | null;
  source_url: string | null;
  os: string | null;
  browser: string | null;
  device_type: string | null;
  escalated_at: string | null;
  resolved_at: string | null;
  summary: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  message_id: string | null;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  /** URL signée temporaire (générée côté serveur, jamais stockée en base). */
  url?: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: MessageSender;
  agent_id: string | null;
  content: string;
  content_html: string | null;
  internal_note: boolean;
  created_at: string;
  attachments?: Attachment[];
  agent_name?: string | null;
}

export interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  embedding: number[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  indexed?: boolean;
}

export interface CannedResponse {
  id: string;
  title: string;
  content: string;
  shortcode: string;
  folder: string;
  visibility: CannedVisibility;
  agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BotSettings {
  bot_name: string;
  avatar_url: string | null;
  welcome_message: string;
  fallback_message: string;
  offline_message: string;
  tone: 'formal' | 'casual';
  reply_length: 'concise' | 'normal' | 'detailed';
  small_talk_enabled: boolean;
  accent_color: string;
  suggestions: string[];
  rag_threshold: number;
  rag_top_k: number;
  /** Politique de confidentialité affichée dans le pied du widget (S-11). */
  privacy_url: string | null;
}

export interface BusinessHours {
  timezone: string;
  weekly: Record<string, [string, string][]>;
  holidays: { date: string; name: string }[];
}

export interface AgentAbsence {
  id: string;
  agent_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  agent_id: string;
  type: 'assigned' | 'new_message' | 'mention';
  title: string;
  body: string | null;
  conversation_id: string | null;
  read: boolean;
  created_at: string;
}

/** Contexte capturé par le widget au chargement. */
export interface VisitorContext {
  url: string;
  os: string;
  browser: string;
  device_type: string;
}

/** Paramètres publics du widget (subset de bot_settings). */
export interface WidgetSettings {
  bot_name: string;
  avatar_url: string | null;
  welcome_message: string;
  accent_color: string;
  suggestions: string[];
  /** Politique de confidentialité, affichée dans le pied du widget (S-11). */
  privacy_url: string | null;
}
