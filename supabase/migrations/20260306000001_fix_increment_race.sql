-- Fix: handle concurrent first-request race with ON CONFLICT + re-lock fallback.
-- The original version could PK-violate when two concurrent requests for a new user
-- both get NOT FOUND from SELECT FOR UPDATE and both try to INSERT.

CREATE OR REPLACE FUNCTION increment_oracle_query(
  p_user_id   uuid,
  p_limit     int,
  p_window_ms bigint
)
RETURNS TABLE (allowed boolean, new_count int, window_start timestamptz)
LANGUAGE plpgsql
AS $$
DECLARE
  v_row oracle_queries%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  -- Try to lock the existing row
  SELECT oq.* INTO v_row
    FROM oracle_queries oq
   WHERE oq.user_id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    -- First query ever — use ON CONFLICT to handle concurrent first requests
    INSERT INTO oracle_queries (user_id, count, window_start)
    VALUES (p_user_id, 1, v_now)
    ON CONFLICT (user_id) DO NOTHING;

    IF FOUND THEN
      RETURN QUERY SELECT true, 1, v_now;
      RETURN;
    END IF;

    -- Lost the race — another txn inserted first. Re-lock and fall through.
    SELECT oq.* INTO v_row
      FROM oracle_queries oq
     WHERE oq.user_id = p_user_id
       FOR UPDATE;
  END IF;

  -- Check if window expired
  IF EXTRACT(EPOCH FROM (v_now - v_row.window_start)) * 1000 >= p_window_ms THEN
    -- Reset window
    UPDATE oracle_queries
       SET count = 1, window_start = v_now
     WHERE oracle_queries.user_id = p_user_id;

    RETURN QUERY SELECT true, 1, v_now;
    RETURN;
  END IF;

  -- Window still active — check limit
  IF v_row.count >= p_limit THEN
    RETURN QUERY SELECT false, v_row.count, v_row.window_start;
    RETURN;
  END IF;

  -- Increment
  UPDATE oracle_queries
     SET count = v_row.count + 1
   WHERE oracle_queries.user_id = p_user_id;

  RETURN QUERY SELECT true, v_row.count + 1, v_row.window_start;
  RETURN;
END;
$$;
