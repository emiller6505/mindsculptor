create table articles (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  url text unique not null,
  title text not null,
  author text,
  published_at timestamptz not null,
  format text,
  scraped_at timestamptz default now()
);

create table article_chunks (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1024),
  archetypes text[] not null default '{}',
  cards_mentioned text[] not null default '{}',
  unique (article_id, chunk_index)
);

create index on article_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
create index on articles (format, published_at desc);
create index on articles (source, url);
