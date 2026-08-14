-- 0010 — Sécurisation du temps réel et durcissement Postgres
--
-- Contexte : jusqu'ici les canaux Realtime étaient PUBLICS. La clé anon étant
-- publique par conception (elle est dans le bundle du widget), n'importe qui
-- pouvait s'abonner à `inbox:all`, y lire l'id de chaque nouvelle conversation,
-- puis rejoindre `conv:{id}` et suivre en direct l'intégralité des échanges —
-- notes internes comprises. Le RLS des tables ne protégeait rien ici, car le
-- temps réel ne passe pas par elles.
--
-- Désormais les clients s'abonnent en canal PRIVÉ : Realtime vérifie chaque
-- abonnement contre les policies de `realtime.messages` ci-dessous.
--  - SELECT = droit de RECEVOIR sur le topic.
--  - INSERT = droit d'ÉMETTRE. Aucune policy : seul le serveur diffuse, via
--    l'API REST en clé service role, qui contourne le RLS.
--
-- Deux profils d'abonnés :
--  1. Visiteur du widget — JWT court signé par le serveur (voir
--     src/lib/visitor-token.ts), portant la revendication `conversation_id`.
--     N'accède qu'à SA conversation.
--  2. Agent — JWT de session Supabase. Accède à `inbox:all`, à toutes les
--     conversations, et à son seul canal de notifications personnel.

-- NB : pas de `alter table realtime.messages enable row level security` ici.
-- Supabase l'active deja par defaut, et cette table appartient a un role
-- interne : l'instruction echoue avec « must be owner of table messages » et
-- fait avorter tout le reste du script. Seules les policies nous incombent.

-- ── 1. Visiteur : uniquement le canal de sa propre conversation ───────────
drop policy if exists "visiteur recoit sa conversation" on realtime.messages;
create policy "visiteur recoit sa conversation"
  on realtime.messages
  for select
  to anon
  using (
    extension = 'broadcast'
    and realtime.topic() = 'conv:' || coalesce(auth.jwt() ->> 'conversation_id', '-')
  );

-- ── 2. Agent : boîte de réception, conversations, son canal personnel ─────
drop policy if exists "agent recoit ses canaux" on realtime.messages;
create policy "agent recoit ses canaux"
  on realtime.messages
  for select
  to authenticated
  using (
    extension = 'broadcast'
    and exists (
      select 1 from public.agents a where a.auth_user_id = auth.uid()
    )
    and (
      realtime.topic() = 'inbox:all'
      or realtime.topic() like 'conv:%'
      or realtime.topic() = 'agent:' || (
        select a.id::text from public.agents a where a.auth_user_id = auth.uid()
      )
    )
  );

-- ── 3. Durcissement : la recherche vectorielle n'est pas exposée au client ─
-- `match_articles` est en SECURITY INVOKER, donc le RLS de `articles` renvoie
-- déjà zéro ligne à un appelant anon. On ne veut pas que la protection repose
-- sur ce seul effet de bord : la fonction n'est appelée que côté serveur.
-- Retirer a PUBLIC, et pas seulement a anon/authenticated : Postgres accorde
-- EXECUTE a PUBLIC a la creation d'une fonction, si bien qu'un revoke cible sur
-- ces deux roles ne retire rien du tout — ils conservent le droit via PUBLIC.
-- Verifie : avant correction, la cle anon obtenait encore 200 sur
-- /rest/v1/rpc/match_articles.
revoke execute on function public.match_articles(vector, int) from public, anon, authenticated;

-- La fonction n'est appelee que par les routes serveur, en cle service role :
-- il faut donc lui re-accorder explicitement le droit qu'on vient d'oter a tous.
grant execute on function public.match_articles(vector, int) to service_role;

-- ── 4. Durcissement : search_path figé sur les fonctions SECURITY DEFINER ─
alter function public.touch_conversation() set search_path = public, pg_temp;
alter function public.set_updated_at() set search_path = public, pg_temp;
