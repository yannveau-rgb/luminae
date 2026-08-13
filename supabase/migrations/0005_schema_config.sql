-- 0005 — Schéma : base de connaissances, réponses prédéfinies, réglages

-- ── Base de connaissances ─────────────────────────────────────────────────
-- embedding : 1024 dimensions (modèle mistral-embed)
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text not null default 'Général',
  tags text[] not null default '{}',
  embedding vector(1024),
  created_by uuid references public.agents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articles_embedding_idx
  on public.articles using hnsw (embedding vector_cosine_ops);

-- ── Réponses prédéfinies ──────────────────────────────────────────────────
-- visibility : personal (agent_id requis) | shared (agent_id null)
create table if not exists public.canned_responses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  shortcode text not null,
  folder text not null default 'Général',
  visibility text not null default 'personal' check (visibility in ('personal', 'shared')),
  agent_id uuid references public.agents(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visibility = 'shared' or agent_id is not null)
);

create unique index if not exists canned_shortcode_unique
  on public.canned_responses (shortcode, coalesce(agent_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ── Réglages du bot (singleton, id = 1) ───────────────────────────────────
create table if not exists public.bot_settings (
  id integer primary key default 1 check (id = 1),
  bot_name text not null default 'Lumi',
  avatar_url text,
  welcome_message text not null default 'Bonjour 👋 Posez-moi votre question.',
  fallback_message text not null default 'Je transmets votre demande à un agent.',
  offline_message text not null default 'Nos agents ne sont pas disponibles pour le moment.',
  tone text not null default 'casual' check (tone in ('formal', 'casual')),
  reply_length text not null default 'normal' check (reply_length in ('concise', 'normal', 'detailed')),
  small_talk_enabled boolean not null default true,
  accent_color text not null default '#0E8C7D',
  suggestions jsonb not null default '[]'::jsonb,
  rag_threshold numeric not null default 0.32,           -- score cosine minimal (Mistral)
  rag_top_k integer not null default 4,
  updated_at timestamptz not null default now()
);

-- ── Horaires d'ouverture (singleton, id = 1) ──────────────────────────────
-- weekly : { "monday": [["09:00","12:30"],["14:00","18:00"]], ... }
-- holidays : [{ "date": "2026-12-25", "name": "Noël" }]
create table if not exists public.business_hours (
  id integer primary key default 1 check (id = 1),
  timezone text not null default 'Europe/Paris',
  weekly jsonb not null default '{}'::jsonb,
  holidays jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── Absences des agents ───────────────────────────────────────────────────
create table if not exists public.agent_absences (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid references public.agents(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- ── Notifications agents ──────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  type text not null check (type in ('assigned', 'new_message', 'mention')),
  title text not null,
  body text,
  conversation_id uuid references public.conversations(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_agent_idx on public.notifications (agent_id, created_at desc);

-- ── RLS sur les tables ci-dessus (mêmes règles que 0004 : aucun accès direct
--    côté client, tout passe par les routes API avec la clé service role) ───
alter table public.articles enable row level security;
alter table public.canned_responses enable row level security;
alter table public.bot_settings enable row level security;
alter table public.business_hours enable row level security;
alter table public.agent_absences enable row level security;
alter table public.notifications enable row level security;
