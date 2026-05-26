CREATE TABLE pl_activations (
  address TEXT PRIMARY KEY,

  -- X account info (confirmed via twitterapi.io)
  x_handle TEXT,
  x_user_id TEXT,
  x_handle_confirmed_at TIMESTAMPTZ,
  x_follow_at TIMESTAMPTZ,

  -- Farcaster (optional, opt-in only)
  fid BIGINT,
  fc_handle TEXT,
  fc_verified_at TIMESTAMPTZ,

  -- Activation completion
  activated_at TIMESTAMPTZ,

  -- Anti-Sybil (R2 mitigation) — operator-curated
  is_blacklisted BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lock only CONFIRMED rows (per R16 graceful degradation)
CREATE UNIQUE INDEX idx_pl_activations_x_handle ON pl_activations (LOWER(x_handle))
  WHERE x_handle IS NOT NULL AND x_handle_confirmed_at IS NOT NULL;

-- One FID per wallet
CREATE UNIQUE INDEX idx_pl_activations_fid ON pl_activations (fid)
  WHERE fid IS NOT NULL;

-- Index for finalize-time filtering
CREATE INDEX idx_pl_activations_activated ON pl_activations (activated_at)
  WHERE activated_at IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_activations TO service_role;
