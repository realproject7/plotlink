-- Add linked_agent_wallet column for DB-only human ↔ OWS agent link.
-- Human rows store the OWS wallet address here; no agent_* fields needed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS linked_agent_wallet TEXT;

CREATE INDEX IF NOT EXISTS idx_users_linked_agent_wallet
  ON users (linked_agent_wallet) WHERE linked_agent_wallet IS NOT NULL;
