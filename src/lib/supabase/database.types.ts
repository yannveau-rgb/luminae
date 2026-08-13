/**
 * Types générés à la main — miroir du schéma Postgres Luminae.
 * Équivalent à la sortie de `supabase gen types typescript --db-only`.
 * Requis par postgrest-js v2+ : sans type Database, les requêtes
 * sont inférées `never`.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      agents: {
        Row: {
          id: string;
          auth_user_id: string | null;
          email: string;
          full_name: string | null;
          role: string;
          avatar_url: string | null;
          notification_prefs: Json;
          silent_mode: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          email: string;
          full_name?: string | null;
          role?: string;
          avatar_url?: string | null;
          notification_prefs?: Json;
          silent_mode?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          email?: string;
          full_name?: string | null;
          role?: string;
          avatar_url?: string | null;
          notification_prefs?: Json;
          silent_mode?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      visitors: {
        Row: {
          id: string;
          token: string;
          display_name: string | null;
          first_seen_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          token: string;
          display_name?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          token?: string;
          display_name?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          visitor_id: string;
          status: string;
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
        };
        Insert: {
          id?: string;
          visitor_id: string;
          status?: string;
          assigned_agent_id?: string | null;
          source_url?: string | null;
          os?: string | null;
          browser?: string | null;
          device_type?: string | null;
          escalated_at?: string | null;
          resolved_at?: string | null;
          summary?: string | null;
          unread_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          visitor_id?: string;
          status?: string;
          assigned_agent_id?: string | null;
          source_url?: string | null;
          os?: string | null;
          browser?: string | null;
          device_type?: string | null;
          escalated_at?: string | null;
          resolved_at?: string | null;
          summary?: string | null;
          unread_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender: string;
          agent_id: string | null;
          content: string;
          content_html: string | null;
          internal_note: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender: string;
          agent_id?: string | null;
          content: string;
          content_html?: string | null;
          internal_note?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender?: string;
          agent_id?: string | null;
          content?: string;
          content_html?: string | null;
          internal_note?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          message_id: string | null;
          storage_path: string;
          file_name: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id?: string | null;
          storage_path: string;
          file_name?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string | null;
          storage_path?: string;
          file_name?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      message_feedback: {
        Row: {
          id: string;
          message_id: string;
          visitor_id: string | null;
          value: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          visitor_id?: string | null;
          value: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          visitor_id?: string | null;
          value?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      articles: {
        Row: {
          id: string;
          title: string;
          content: string;
          category: string;
          tags: string[];
          embedding: number[] | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          category?: string;
          tags?: string[];
          embedding?: number[] | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          category?: string;
          tags?: string[];
          embedding?: number[] | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      canned_responses: {
        Row: {
          id: string;
          title: string;
          content: string;
          shortcode: string;
          folder: string;
          visibility: string;
          agent_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          shortcode: string;
          folder?: string;
          visibility?: string;
          agent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          shortcode?: string;
          folder?: string;
          visibility?: string;
          agent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bot_settings: {
        Row: {
          id: number;
          bot_name: string;
          avatar_url: string | null;
          welcome_message: string;
          fallback_message: string;
          offline_message: string;
          tone: string;
          reply_length: string;
          small_talk_enabled: boolean;
          accent_color: string;
          suggestions: Json;
          rag_threshold: number;
          rag_top_k: number;
          updated_at: string;
        };
        Insert: {
          id?: number;
          bot_name?: string;
          avatar_url?: string | null;
          welcome_message?: string;
          fallback_message?: string;
          offline_message?: string;
          tone?: string;
          reply_length?: string;
          small_talk_enabled?: boolean;
          accent_color?: string;
          suggestions?: Json;
          rag_threshold?: number;
          rag_top_k?: number;
          updated_at?: string;
        };
        Update: {
          id?: number;
          bot_name?: string;
          avatar_url?: string | null;
          welcome_message?: string;
          fallback_message?: string;
          offline_message?: string;
          tone?: string;
          reply_length?: string;
          small_talk_enabled?: boolean;
          accent_color?: string;
          suggestions?: Json;
          rag_threshold?: number;
          rag_top_k?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      business_hours: {
        Row: {
          id: number;
          timezone: string;
          weekly: Json;
          holidays: Json;
          updated_at: string;
        };
        Insert: {
          id?: number;
          timezone?: string;
          weekly?: Json;
          holidays?: Json;
          updated_at?: string;
        };
        Update: {
          id?: number;
          timezone?: string;
          weekly?: Json;
          holidays?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      agent_absences: {
        Row: {
          id: string;
          agent_id: string;
          starts_at: string;
          ends_at: string;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          starts_at: string;
          ends_at: string;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          starts_at?: string;
          ends_at?: string;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          agent_id: string;
          type: string;
          title: string;
          body: string | null;
          conversation_id: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          type: string;
          title: string;
          body?: string | null;
          conversation_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          type?: string;
          title?: string;
          body?: string | null;
          conversation_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_articles: {
        Args: { query_embedding: number[]; match_count?: number };
        Returns: {
          id: string;
          title: string;
          content: string;
          category: string;
          tags: string[];
          similarity: number;
        }[];
      };
      rate_limit_hit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      rate_limit_gc: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
