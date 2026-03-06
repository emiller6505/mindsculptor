-- Enable RLS on all public tables and set policies.
-- Without RLS, any client with the anon key has full access to all tables.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Public read-only tables (SELECT for anon + authenticated, no INSERT/UPDATE/DELETE)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON tournaments FOR SELECT USING (true);

ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON decks FOR SELECT USING (true);

ALTER TABLE deck_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON deck_cards FOR SELECT USING (true);

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON cards FOR SELECT USING (true);

ALTER TABLE archetypes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON archetypes FOR SELECT USING (true);

ALTER TABLE metagame_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON metagame_snapshots FOR SELECT USING (true);

ALTER TABLE deck_archetypes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON deck_archetypes FOR SELECT USING (true);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON matches FOR SELECT USING (true);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON articles FOR SELECT USING (true);

ALTER TABLE article_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON article_chunks FOR SELECT USING (true);

ALTER TABLE card_name_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON card_name_aliases FOR SELECT USING (true);

ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON embeddings FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Server-only tables (no anon access — service_role bypasses RLS)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;
-- No policies = no access via anon/authenticated. Service role bypasses RLS.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Per-user tables
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE oracle_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own" ON oracle_queries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users insert own" ON oracle_queries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own" ON oracle_queries
  FOR UPDATE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- RPC functions that need to bypass RLS
-- ═══════════════════════════════════════════════════════════════════════════════

-- sum_daily_queries reads ALL users' rows for the circuit breaker
ALTER FUNCTION sum_daily_queries(timestamptz) SECURITY DEFINER;

-- increment_oracle_query does INSERT/UPDATE and is called server-side only
ALTER FUNCTION increment_oracle_query(uuid, int, bigint) SECURITY DEFINER;
