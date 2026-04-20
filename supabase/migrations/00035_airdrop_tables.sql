-- Airdrop campaign tables (#878)
-- Parent: #877

-- PL Point ledger (append-only)
CREATE TABLE pl_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  action TEXT NOT NULL,            -- 'buy', 'referral', 'write', 'rate'
  points NUMERIC NOT NULL,
  metadata JSONB,                  -- { tx_hash, storyline_id, referred_address, trade_id }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pl_points_address ON pl_points (address);
CREATE INDEX idx_pl_points_action ON pl_points (action);

-- Referral relationships
CREATE TABLE pl_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_address TEXT NOT NULL,
  referred_address TEXT NOT NULL UNIQUE,
  referral_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pl_referrals_referrer ON pl_referrals (referrer_address);

-- Referral codes (one per wallet, immutable once set)
CREATE TABLE pl_referral_codes (
  address TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  is_farcaster_username BOOLEAN NOT NULL DEFAULT FALSE
);

-- Daily check-in streaks
CREATE TABLE pl_streaks (
  address TEXT PRIMARY KEY,
  current_streak INTEGER NOT NULL DEFAULT 0,
  last_checkin TIMESTAMPTZ,
  longest_streak INTEGER NOT NULL DEFAULT 0
);

-- Daily PLOT price snapshots (for TWAP)
CREATE TABLE pl_daily_prices (
  id SERIAL PRIMARY KEY,
  price_usd NUMERIC NOT NULL,
  supply NUMERIC NOT NULL,
  mcap_usd NUMERIC NOT NULL,
  recorded_at DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE
);

-- Weekly campaign stats
CREATE TABLE pl_weekly_snapshots (
  id SERIAL PRIMARY KEY,
  week_number INTEGER NOT NULL UNIQUE,
  week_start DATE NOT NULL,
  new_stories INTEGER NOT NULL DEFAULT 0,
  token_buys INTEGER NOT NULL DEFAULT 0,
  new_referrals INTEGER NOT NULL DEFAULT 0,
  mcap_start NUMERIC,
  mcap_end NUMERIC,
  total_pl_earned NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
