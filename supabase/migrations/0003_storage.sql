-- 0003 — Bucket de stockage pour les pièces jointes
-- Bucket privé : l'accès se fait uniquement via URL signée générée côté serveur.

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Aucune policy permissive : seul le service role (utilisé par les API
-- serveur) peut lire/écrire. Les visiteurs et agents n'accèdent jamais
-- directement au bucket.
