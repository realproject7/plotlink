CREATE OR REPLACE FUNCTION weighted_spend(
  p_campaign_start TIMESTAMPTZ,
  p_campaign_end TIMESTAMPTZ,
  p_min_referral_threshold NUMERIC,
  p_multiplier_per_ref NUMERIC,
  p_multiplier_cap NUMERIC
)
RETURNS TABLE (
  address TEXT,
  buy_volume NUMERIC,
  qualified_refs BIGINT,
  has_fc_bonus INTEGER,
  multiplier NUMERIC,
  weighted_spend NUMERIC,
  community_total NUMERIC
)
LANGUAGE SQL STABLE
AS $$
  WITH eligible AS (
    SELECT
      a.address,
      CASE WHEN a.fid IS NOT NULL THEN 1 ELSE 0 END AS has_fc_bonus
    FROM pl_activations a
    WHERE a.activated_at IS NOT NULL
      AND a.is_blacklisted = FALSE
  ),
  buys AS (
    SELECT p.address, COALESCE(SUM(p.points), 0) AS buy_volume
    FROM pl_points p
    WHERE p.action = 'buy'
      AND p.created_at >= p_campaign_start
      AND p.created_at <= p_campaign_end
    GROUP BY p.address
  ),
  eligible_buys AS (
    SELECT e.address, e.has_fc_bonus, COALESCE(b.buy_volume, 0) AS buy_volume
    FROM eligible e
    JOIN buys b ON e.address = b.address
  ),
  qualified_refs AS (
    SELECT r.referrer_address AS address, COUNT(*) AS ref_count
    FROM pl_referrals r
    JOIN eligible_buys eb ON r.referred_address = eb.address
    WHERE eb.buy_volume >= p_min_referral_threshold
    GROUP BY r.referrer_address
  ),
  weighted AS (
    SELECT
      eb.address,
      eb.buy_volume,
      COALESCE(qr.ref_count, 0) AS qualified_refs,
      eb.has_fc_bonus,
      LEAST(
        1 + (COALESCE(qr.ref_count, 0) + eb.has_fc_bonus) * p_multiplier_per_ref,
        p_multiplier_cap
      ) AS multiplier,
      eb.buy_volume * LEAST(
        1 + (COALESCE(qr.ref_count, 0) + eb.has_fc_bonus) * p_multiplier_per_ref,
        p_multiplier_cap
      ) AS weighted_spend
    FROM eligible_buys eb
    LEFT JOIN qualified_refs qr ON eb.address = qr.address
  )
  SELECT
    w.address,
    w.buy_volume,
    w.qualified_refs,
    w.has_fc_bonus,
    w.multiplier,
    w.weighted_spend,
    SUM(w.weighted_spend) OVER () AS community_total
  FROM weighted w;
$$;

GRANT EXECUTE ON FUNCTION weighted_spend TO service_role;
