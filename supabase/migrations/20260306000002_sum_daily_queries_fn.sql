-- Returns the total number of queries made today across all users.
-- Used by the circuit breaker to cap daily API spend.
CREATE OR REPLACE FUNCTION sum_daily_queries(p_since timestamptz)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(count), 0)
    FROM oracle_queries
   WHERE window_start >= p_since;
$$;
