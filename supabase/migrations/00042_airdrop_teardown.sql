-- Airdrop teardown (campaign paused). Data archived separately before apply.
DROP FUNCTION IF EXISTS weighted_spend(TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC);
DROP TABLE IF EXISTS pl_airdrop_proofs;
DROP TABLE IF EXISTS pl_weekly_snapshots;
DROP TABLE IF EXISTS pl_daily_prices;
DROP TABLE IF EXISTS pl_referrals;
DROP TABLE IF EXISTS pl_referral_codes;
DROP TABLE IF EXISTS pl_streaks;
DROP TABLE IF EXISTS pl_points;
DROP TABLE IF EXISTS pl_activations;
