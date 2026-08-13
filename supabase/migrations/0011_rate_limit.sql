-- 0011 — Limitation de débit des routes publiques du widget
--
-- Les routes /api/widget/* sont ouvertes (le token visiteur est auto-généré
-- côté navigateur, il ne constitue pas une barrière). Or chaque message
-- déclenche un embedding puis une complétion Mistral : sans quota, une simple
-- boucle épuise le budget API et sature les fonctions serverless.
--
-- Le compteur vit en base plutôt qu'en mémoire : les fonctions serverless sont
-- sans état et réparties sur plusieurs instances, un compteur local ne
-- limiterait rien.

create table if not exists public.rate_limits (
  bucket text primary key,                               -- ex. « msg:ip:1.2.3.4 »
  window_start timestamptz not null default now(),
  count integer not null default 0
);

alter table public.rate_limits enable row level security;  -- aucun accès direct client

-- Purge des fenêtres expirées (appelée occasionnellement, garde la table petite).
create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

/**
 * Incrémente le compteur du seau et indique si l'appel est autorisé.
 * Retourne true si la requête passe, false si le quota est dépassé.
 * Fenêtre glissante par bloc : le compteur repart de 1 dès que la fenêtre
 * courante a expiré.
 */
create or replace function public.rate_limit_hit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits as rl (bucket, window_start, count)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update
    set count = case
          when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else rl.count + 1
        end,
        window_start = case
          when rl.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else rl.window_start
        end
  returning rl.count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Appelée uniquement par les routes serveur (clé service role).
revoke execute on function public.rate_limit_hit(text, integer, integer) from anon, authenticated;

/** Supprime les seaux dont la fenêtre est expirée depuis plus d'une heure. */
create or replace function public.rate_limit_gc()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.rate_limits where window_start < now() - interval '1 hour';
$$;

revoke execute on function public.rate_limit_gc() from anon, authenticated;
