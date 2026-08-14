-- 0013 — Conservation des données et transparence (constat S-11)
--
-- La plateforme traite des échanges de candidats à des évaluations, et la page
-- d'accueil affiche « Conformité ». Or il n'existait aucune politique de purge,
-- aucun moyen d'effacer, et aucune information sur le traitement par IA.
-- L'hébergement en UE, seul, ne couvre pas ces obligations.
--
-- Cette migration ajoute le lien vers la politique de confidentialité, affiché
-- dans le widget. La purge et l'effacement sont implémentés côté application
-- (src/lib/retention.ts) et non en SQL : ils doivent supprimer les fichiers du
-- bucket AVANT les lignes, or la cascade SQL ne touche pas au stockage objet.

alter table public.bot_settings
  add column if not exists privacy_url text;

comment on column public.bot_settings.privacy_url is
  'URL publique de la politique de confidentialité, affichée dans le pied du widget. https uniquement.';

-- ── Index utile aux requêtes de purge ─────────────────────────────────────
-- La purge cible les conversations résolues les plus anciennes ; sans index sur
-- resolved_at, elle dégénère en balayage complet à mesure que la table grossit.
create index if not exists conversations_resolved_at_idx
  on public.conversations (resolved_at)
  where status = 'resolved';

create index if not exists visitors_last_seen_idx
  on public.visitors (last_seen_at);
