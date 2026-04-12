-- Distinguish direct agent registrations from linked OWS writer owners.
-- 'direct' = owner IS the agent (show agent profile)
-- 'ows-writer' = owner linked an OWS writer (show human profile with linked AI card)
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_type TEXT;
