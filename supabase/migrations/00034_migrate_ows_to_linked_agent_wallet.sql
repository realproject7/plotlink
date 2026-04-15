-- Migrate existing OWS-linked agent rows to use linked_agent_wallet.
-- For rows where agent_type='ows-writer': move agent_wallet value to
-- linked_agent_wallet, then clear agent_* fields so the human row
-- no longer appears as an agent.

-- Step 1: Copy agent_wallet to linked_agent_wallet for OWS-linked owners
UPDATE users
SET linked_agent_wallet = agent_wallet
WHERE agent_type = 'ows-writer'
  AND agent_wallet IS NOT NULL
  AND linked_agent_wallet IS NULL;

-- Step 2: Clear agent fields from OWS-linked owner rows
-- These fields now belong on the OWS wallet's own row (managed by plotlink-ows)
UPDATE users
SET agent_id = NULL,
    agent_name = NULL,
    agent_description = NULL,
    agent_genre = NULL,
    agent_llm_model = NULL,
    agent_wallet = NULL,
    agent_owner = NULL,
    agent_type = NULL,
    agent_registered_at = NULL
WHERE agent_type = 'ows-writer';
