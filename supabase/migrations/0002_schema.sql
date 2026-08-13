-- 0002 — Schéma principal (conversations & visiteurs)

-- ── Équipe ────────────────────────────────────────────────────────────────
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,                              -- lien vers auth.users
  email text not null unique,
  full_name text,
  role text not null default 'agent' check (role in ('admin', 'agent')),
  avatar_url text,
  notification_prefs jsonb not null default '{"assigned": true, "new_message": true, "mention": true}'::jsonb,
  silent_mode boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Visiteurs anonymes du widget ──────────────────────────────────────────
create table if not exists public.visitors (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,                            -- uuid généré côté navigateur (localStorage)
  display_name text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- ── Conversations ─────────────────────────────────────────────────────────
-- status : bot = bot en cours | waiting = en attente d'agent
--          assigned = prise en charge | resolved = résolue
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.visitors(id) on delete cascade,
  status text not null default 'bot' check (status in ('bot', 'waiting', 'assigned', 'resolved')),
  assigned_agent_id uuid references public.agents(id) on delete set null,
  source_url text,
  os text,
  browser text,
  device_type text,
  escalated_at timestamptz,
  resolved_at timestamptz,
  summary text,                                          -- résumé IA à la prise en charge
  unread_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_status_idx on public.conversations (status, updated_at desc);
create index if not exists conversations_visitor_idx on public.conversations (visitor_id);

-- ── Messages ──────────────────────────────────────────────────────────────
-- sender : visitor | bot | agent | system
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender text not null check (sender in ('visitor', 'bot', 'agent', 'system')),
  agent_id uuid references public.agents(id) on delete set null,
  content text not null,                                 -- texte brut (utilisé par l'IA)
  content_html text,                                     -- rendu riche (composer agent)
  internal_note boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

-- ── Pièces jointes ────────────────────────────────────────────────────────
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages(id) on delete cascade,
  storage_path text not null,
  file_name text,
  mime_type text,
  size_bytes integer,
  created_at timestamptz not null default now()
);

-- ── Feedback 👍/👎 sur les réponses du bot ────────────────────────────────
create table if not exists public.message_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  visitor_id uuid references public.visitors(id) on delete set null,
  value text not null check (value in ('up', 'down')),
  created_at timestamptz not null default now(),
  unique (message_id)                                    -- un seul vote par message
);
