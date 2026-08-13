-- 0009 — Correctif : conversations.escalated_at
-- La définition initiale (0002) était « timestamptz not null default null »,
-- contradiction qui faisait échouer TOUTE création de conversation (le message
-- visiteur ne fournit pas escalated_at). La colonne doit être nullable : une
-- conversation n'est pas escaladée à sa création.
alter table public.conversations
  alter column escalated_at drop not null;
