-- 0014 — Refonte de l'identité visiteur par session anonyme Supabase (constat S-05)
--
-- Contexte : jusqu'ici, le serveur signait un JWT HS256 avec SUPABASE_JWT_SECRET
-- pour autoriser l'abonnement du visiteur au canal privé de sa conversation.
-- Supabase ayant basculé sur des clés asymétriques ECC, ce secret était obsolète
-- et sa révocation aurait invalidé les jetons visiteurs.
--
-- Désormais, le visiteur s'authentifie via supabase.auth.signInAnonymously().
-- Supabase signe le jeton avec sa clé asymétrique courante et fournit un auth.uid().
-- La policy realtime.messages compare auth.uid() au visiteur propriétaire de la conversation.

alter table public.visitors
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create index if not exists visitors_auth_user_id_idx
  on public.visitors (auth_user_id);

-- ── Policy Realtime pour le visiteur (utilise auth.uid()) ─────────────────────
-- Remplacement de l'ancienne policy basée sur la revendication HS256 conversation_id.
-- Désormais, le visiteur reçoit les messages du canal conv:{id} dès lors qu'il
-- est le propriétaire de cette conversation.
drop policy if exists "visiteur recoit sa conversation" on realtime.messages;
create policy "visiteur recoit sa conversation"
  on realtime.messages
  for select
  to authenticated
  using (
    extension = 'broadcast'
    and exists (
      select 1
      from public.conversations c
      join public.visitors v on v.id = c.visitor_id
      where v.auth_user_id = auth.uid()
        and realtime.topic() = 'conv:' || c.id::text
    )
  );
