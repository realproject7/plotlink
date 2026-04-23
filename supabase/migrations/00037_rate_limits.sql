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
