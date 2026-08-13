-- 0004 — Row Level Security
-- Principe V1 : toutes les écritures/lectures passent par les routes API
-- Next.js qui utilisent la clé service role. Le RLS est donc activé SANS
-- policy permissive : la clé anon (celle du widget) n'a accès à rien en
-- direct. Le temps réel passe par Realtime Broadcast (émis côté serveur).

alter table public.agents enable row level security;
alter table public.visitors enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.attachments enable row level security;
alter table public.message_feedback enable row level security;
-- (RLS des tables articles / canned_responses / bot_settings / business_hours /
--  agent_absences / notifications : activé dans 0005 après leur création)

-- Note : si une future version autorise des lectures directes côté client
-- (ex. dashboard qui lit via supabase-js), ajouter des policies ciblées ici
-- plutôt que de désactiver le RLS.
