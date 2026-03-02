-- Enable pgvector extension
create extension if not exists vector;

-- ============================================================
-- CARDS (sourced from Scryfall)
-- ============================================================
create table cards (
  id            text primary key,           -- Scryfall UUID
  name          text not null,
  oracle_text   text,
  type_line     text,
  mana_cost     text,
  cmc           numeric,
  colors        text[],
  color_identity text[],
  legalities    jsonb not null default '{}', -- { modern: 'legal', standard: 'not_legal', ... }
  set_code      text,
  collector_number text,
  rarity        text,
  image_uri     text,
  updated_at    timestamptz not null default now()
);

create index idx_cards_name on cards (name);
create index idx_cards_legalities on cards using gin (legalities);

-- ============================================================
-- TOURNAMENTS
-- ============================================================
create table tournaments (
  id            text primary key,           -- stable hash of source + source_id
  name          text not null,
  format        text not null,              -- 'modern' | 'standard'
  date          date not null,
  source        text not null,              -- 'mtgo' | 'mtggoldfish' | 'mtgtop8'
  source_url    text,
  tier          text,                       -- 'challenge' | 'preliminary' | 'rcq' | 'regional' | 'pro_tour'
  created_at    timestamptz not null default now()
);

create index idx_tournaments_format_date on tournaments (format, date desc);
create index idx_tournaments_source on tournaments (source);

-- ============================================================
-- DECKS
-- ============================================================
create table decks (
  id            text primary key,           -- stable hash of source + source_id
  tournament_id text references tournaments (id) on delete cascade,
  pilot         text,
  placement     int,                        -- 1, 2, 3... null if unranked
  record        text,                       -- e.g. '7-2'
  source        text not null,
  source_url    text,
  raw_list      jsonb,                      -- original parsed list before normalization
  created_at    timestamptz not null default now()
);

create index idx_decks_tournament on decks (tournament_id);
create index idx_decks_placement on decks (placement);

-- ============================================================
-- DECK CARDS (normalized)
-- ============================================================
create table deck_cards (
  id            bigint generated always as identity primary key,
  deck_id       text not null references decks (id) on delete cascade,
  card_id       text not null references cards (id) on delete restrict,
  quantity      int not null check (quantity > 0),
  is_sideboard  boolean not null default false
);

create index idx_deck_cards_deck on deck_cards (deck_id);
create index idx_deck_cards_card on deck_cards (card_id);

-- ============================================================
-- ARCHETYPES (derived dynamically)
-- ============================================================
create table archetypes (
  id            text primary key,           -- stable slug e.g. 'eldrazi-ramp-modern'
  name          text not null,
  format        text not null,
  description   text,
  key_cards     text[],                     -- card names for fast-path signature matching
  tier          text,                       -- derived: 'S' | 'A' | 'B' | 'C'
  is_overridden boolean not null default false, -- true if admin has manually set values
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_archetypes_format on archetypes (format);

-- ============================================================
-- DECK → ARCHETYPE MAPPING
-- ============================================================
create table deck_archetypes (
  deck_id         text not null references decks (id) on delete cascade,
  archetype_id    text not null references archetypes (id) on delete cascade,
  confidence      numeric not null check (confidence between 0 and 1),
  method          text not null,            -- 'signature' | 'jaccard' | 'llm'
  primary key (deck_id, archetype_id)
);

-- ============================================================
-- METAGAME SNAPSHOTS (materialized, recomputed by analyzer)
-- ============================================================
create table metagame_snapshots (
  id              bigint generated always as identity primary key,
  format          text not null,
  window_start    date not null,
  window_end      date not null,
  archetype_id    text not null references archetypes (id) on delete cascade,
  top8_count      int not null default 0,
  total_entries   int not null default 0,
  meta_share      numeric,                  -- percentage
  trend_delta     numeric,                  -- change vs prior window
  sample_size     int not null default 0,
  confidence      text not null default 'LOW', -- 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY HIGH'
  computed_at     timestamptz not null default now()
);

create index idx_snapshots_format_window on metagame_snapshots (format, window_end desc);
create index idx_snapshots_archetype on metagame_snapshots (archetype_id);

-- ============================================================
-- SCRAPE JOBS (raw staging — fetcher writes, parser reads)
-- ============================================================
create table scrape_jobs (
  id            bigint generated always as identity primary key,
  source        text not null,              -- 'mtgo' | 'mtggoldfish' | 'mtgtop8' | 'scryfall'
  source_url    text,
  raw_content   text,                       -- raw HTML or JSON
  status        text not null default 'pending', -- 'pending' | 'parsed' | 'failed' | 'skipped'
  error         text,
  fetched_at    timestamptz not null default now(),
  parsed_at     timestamptz
);

create index idx_scrape_jobs_status on scrape_jobs (status);
create index idx_scrape_jobs_source on scrape_jobs (source, fetched_at desc);

-- ============================================================
-- EMBEDDINGS (pgvector)
-- ============================================================
create table embeddings (
  id            bigint generated always as identity primary key,
  entity_type   text not null,              -- 'deck' | 'archetype' | 'card'
  entity_id     text not null,
  model         text not null,              -- embedding model used
  embedding     vector(1536),               -- OpenAI ada-002 / Claude dimensions
  created_at    timestamptz not null default now(),
  unique (entity_type, entity_id, model)
);

create index idx_embeddings_entity on embeddings (entity_type, entity_id);
-- vector similarity index (IVFFlat — tune lists param after data volume is known)
create index idx_embeddings_vector on embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
