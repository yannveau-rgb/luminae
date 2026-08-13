-- 0001 — Extensions
-- pgvector pour la recherche sémantique (RAG), pgcrypto pour gen_random_uuid().

create extension if not exists pgcrypto;
create extension if not exists vector;
