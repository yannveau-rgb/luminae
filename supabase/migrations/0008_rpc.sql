-- 0008 — Recherche vectorielle (RAG)
-- Similarité cosinus entre l'embedding de la question et ceux des articles.

create or replace function public.match_articles(
  query_embedding vector(1024),
  match_count int default 8
)
returns table (
  id uuid,
  title text,
  content text,
  category text,
  tags text[],
  similarity float
)
language sql stable as $$
  select
    a.id,
    a.title,
    a.content,
    a.category,
    a.tags,
    1 - (a.embedding <=> query_embedding) as similarity
  from public.articles a
  where a.embedding is not null
  order by a.embedding <=> query_embedding
  limit match_count;
$$;
