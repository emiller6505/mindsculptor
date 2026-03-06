-- Prevent anon clients from calling SECURITY DEFINER RPCs directly.
-- The server calls these via the authenticated user's JWT, so authenticated
-- role needs access. Anon does not.

-- sum_daily_queries: only needed by circuit breaker (server-side, authenticated context)
REVOKE EXECUTE ON FUNCTION sum_daily_queries(timestamptz) FROM anon;

-- increment_oracle_query: add auth.uid() guard so even authenticated users
-- can only increment their own row, preventing rate-limit manipulation via
-- direct RPC calls with another user's UUID.
CREATE OR REPLACE FUNCTION increment_oracle_query(
  p_user_id   uuid,
  p_limit     int,
  p_window_ms bigint
)
RETURNS TABLE (allowed boolean, new_count int, window_start timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row oracle_queries%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  -- Guard: caller must be the user they claim to be
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized: uid mismatch';
  END IF;

  -- Try to lock the existing row
  SELECT oq.* INTO v_row
    FROM oracle_queries oq
   WHERE oq.user_id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO oracle_queries (user_id, count, window_start)
    VALUES (p_user_id, 1, v_now)
    ON CONFLICT (user_id) DO NOTHING;

    IF FOUND THEN
      RETURN QUERY SELECT true, 1, v_now;
      RETURN;
    END IF;

    SELECT oq.* INTO v_row
      FROM oracle_queries oq
     WHERE oq.user_id = p_user_id
       FOR UPDATE;
  END IF;

  IF EXTRACT(EPOCH FROM (v_now - v_row.window_start)) * 1000 >= p_window_ms THEN
    UPDATE oracle_queries
       SET count = 1, window_start = v_now
     WHERE oracle_queries.user_id = p_user_id;

    RETURN QUERY SELECT true, 1, v_now;
    RETURN;
  END IF;

  IF v_row.count >= p_limit THEN
    RETURN QUERY SELECT false, v_row.count, v_row.window_start;
    RETURN;
  END IF;

  UPDATE oracle_queries
     SET count = v_row.count + 1
   WHERE oracle_queries.user_id = p_user_id;

  RETURN QUERY SELECT true, v_row.count + 1, v_row.window_start;
  RETURN;
END;
$$;

-- Also revoke anon from increment_oracle_query
REVOKE EXECUTE ON FUNCTION increment_oracle_query(uuid, int, bigint) FROM anon;
