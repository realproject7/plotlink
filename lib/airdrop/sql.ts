import type { AirdropConfig } from "./config";

export interface WeightedSpendQuery {
  sql: string;
  params: (string | number)[];
}

export interface WeightedSpendRow {
  address: string;
  buy_volume: number;
  qualified_refs: number;
  has_fc_bonus: number;
  multiplier: number;
  weighted_spend: number;
  community_total: number;
}

export function weightedSpendQuery(config: AirdropConfig): WeightedSpendQuery {
  const params: (string | number)[] = [
    config.CAMPAIGN_START.toISOString(),
    config.CAMPAIGN_END.toISOString(),
    config.MIN_REFERRAL_THRESHOLD,
    config.REFERRAL_MULTIPLIER_PER_REF,
    config.REFERRAL_MULTIPLIER_CAP,
  ];

  const sql = `
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
    AND p.created_at >= $1
    AND p.created_at <= $2
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
  WHERE eb.buy_volume >= $3
  GROUP BY r.referrer_address
),
weighted AS (
  SELECT
    eb.address,
    eb.buy_volume,
    COALESCE(qr.ref_count, 0) AS qualified_refs,
    eb.has_fc_bonus,
    LEAST(
      1 + (COALESCE(qr.ref_count, 0) + eb.has_fc_bonus) * $4::NUMERIC,
      $5::NUMERIC
    ) AS multiplier,
    eb.buy_volume * LEAST(
      1 + (COALESCE(qr.ref_count, 0) + eb.has_fc_bonus) * $4::NUMERIC,
      $5::NUMERIC
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
FROM weighted w
`.trim();

  return { sql, params };
}
