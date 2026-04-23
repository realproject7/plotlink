-- Rate limiting table for serverless-safe request throttling.
-- Stores recent request timestamps per IP+endpoint key.
CREATE TABLE IF NOT EXISTS rate_limits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limits_key_created ON rate_limits (key, created_at DESC);

-- Auto-purge entries older than 5 minutes
CREATE OR REPLACE FUNCTION purge_old_rate_limits() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM rate_limits WHERE created_at < now() - interval '5 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_purge_rate_limits
  AFTER INSERT ON rate_limits
  FOR EACH STATEMENT
  EXECUTE FUNCTION purge_old_rate_limits();

-- Atomic rate limit check: counts recent requests, inserts if under limit.
-- Returns true if allowed, false if rate limited.
-- Atomic rate limit check: uses advisory lock to serialize per key,
-- counts recent requests, inserts if under limit.
-- Returns true if allowed, false if rate limited.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max_requests INT DEFAULT 5,
  p_window_ms INT DEFAULT 60000
) RETURNS BOOLEAN AS $$
DECLARE
  v_count INT;
  v_window_start TIMESTAMPTZ;
  v_lock_id BIGINT;
BEGIN
  v_lock_id := hashtext(p_key);
  PERFORM pg_advisory_xact_lock(v_lock_id);
  v_window_start := now() - (p_window_ms || ' milliseconds')::interval;
  SELECT count(*) INTO v_count
    FROM rate_limits
    WHERE key = p_key AND created_at >= v_window_start;
  IF v_count >= p_max_requests THEN
    RETURN false;
  END IF;
  INSERT INTO rate_limits (key) VALUES (p_key);
  RETURN true;
END;
$$ LANGUAGE plpgsql;
