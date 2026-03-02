-- ============================================================
-- Audit fixes from Phase 1 review
-- ============================================================

-- 1. Add oracle_id to cards
--    oracle_id is Scryfall's stable per-card-concept identifier across printings.
--    Used as the canonical lookup key when matching parsed decklist card names.
alter table cards add column oracle_id text;
create index idx_cards_oracle_id on cards (oracle_id);

-- 2. Fix deck_cards: source of truth is card_name (what MTGO/decklists provide),
--    card_id is a nullable FK to a specific printing (resolved post-parse if needed).
alter table deck_cards
  add column card_name text,
  alter column card_id drop not null;

-- Backfill card_name from cards table for any existing rows (safe no-op on empty table)
update deck_cards dc
  set card_name = c.name
  from cards c
  where c.id = dc.card_id;

-- Now enforce not null on card_name
alter table deck_cards alter column card_name set not null;
create index idx_deck_cards_card_name on deck_cards (card_name);

-- 3. Unique constraint on metagame_snapshots to prevent duplicate windows
alter table metagame_snapshots
  add constraint uq_snapshots unique (format, window_start, window_end, archetype_id);

-- 4. Switch embeddings from IVFFlat to HNSW
--    HNSW builds incrementally, performs well at any data volume, no reindex needed.
--    Also fix vector dimensions: Voyage AI voyage-3 uses 1024 dims.
drop index idx_embeddings_vector;
alter table embeddings drop column embedding;
alter table embeddings add column embedding vector(1024);
create index idx_embeddings_vector on embeddings
  using hnsw (embedding vector_cosine_ops);

-- 5. Check constraints on all enum-like text fields
alter table scrape_jobs
  add constraint chk_scrape_jobs_status
  check (status in ('pending', 'parsed', 'failed', 'skipped'));

alter table tournaments
  add constraint chk_tournaments_format
  check (format in ('modern', 'standard')),
  add constraint chk_tournaments_tier
  check (tier is null or tier in ('challenge', 'preliminary', 'rcq', 'regional', 'pro_tour'));

alter table archetypes
  add constraint chk_archetypes_tier
  check (tier is null or tier in ('S', 'A', 'B', 'C'));

alter table metagame_snapshots
  add constraint chk_snapshots_confidence
  check (confidence in ('LOW', 'MEDIUM', 'HIGH', 'VERY HIGH'));
