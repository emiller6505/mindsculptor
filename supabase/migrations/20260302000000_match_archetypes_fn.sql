-- pgvector similarity search for archetype matching
create or replace function match_archetypes(
  query_embedding vector(1024),
  format_filter   text,
  match_count     int default 5
)
returns table (
  id         text,
  name       text,
  key_cards  text[],
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    a.id,
    a.name,
    a.key_cards,
    1 - (e.embedding <=> query_embedding) as similarity
  from embeddings e
  join archetypes a on a.id = e.entity_id
  where e.entity_type = 'archetype'
    and e.model = 'voyage-3'
    and a.format = format_filter
  order by e.embedding <=> query_embedding
  limit match_count;
end;
$$;
