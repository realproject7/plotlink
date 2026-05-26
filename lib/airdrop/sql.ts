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

export interface Activation { address: string; activated_at: string | null; is_blacklisted: boolean; fid: number | null }
export interface BuyPoint { address: string; action: string; points: number; created_at: string }
export interface Referral { referrer_address: string; referred_address: string }

export function computeWeightedSpend(
  config: AirdropConfig,
  activations: Activation[],
  buyPoints: BuyPoint[],
  referrals: Referral[],
): WeightedSpendRow[] {
  const eligible = activations
    .filter(a => a.activated_at !== null && !a.is_blacklisted)
    .map(a => ({ address: a.address, has_fc_bonus: a.fid !== null ? 1 : 0 }));

  const eligibleSet = new Set(eligible.map(e => e.address));

  const campStart = config.CAMPAIGN_START.getTime();
  const campEnd = config.CAMPAIGN_END.getTime();

  const buyMap = new Map<string, number>();
  for (const p of buyPoints) {
    if (p.action !== "buy") continue;
    const t = new Date(p.created_at).getTime();
    if (t < campStart || t > campEnd) continue;
    buyMap.set(p.address, (buyMap.get(p.address) ?? 0) + p.points);
  }

  const eligibleBuys = eligible
    .filter(e => (buyMap.get(e.address) ?? 0) > 0)
    .map(e => ({ ...e, buy_volume: buyMap.get(e.address)! }));

  const ebSet = new Set(eligibleBuys.map(e => e.address));

  const refCounts = new Map<string, number>();
  for (const r of referrals) {
    if (!ebSet.has(r.referred_address)) continue;
    const refBuyVol = buyMap.get(r.referred_address) ?? 0;
    if (refBuyVol < config.MIN_REFERRAL_THRESHOLD) continue;
    refCounts.set(r.referrer_address, (refCounts.get(r.referrer_address) ?? 0) + 1);
  }

  const rows = eligibleBuys.map(eb => {
    const qr = refCounts.get(eb.address) ?? 0;
    const multiplier = Math.min(
      1 + (qr + eb.has_fc_bonus) * config.REFERRAL_MULTIPLIER_PER_REF,
      config.REFERRAL_MULTIPLIER_CAP,
    );
    return {
      address: eb.address,
      buy_volume: eb.buy_volume,
      qualified_refs: qr,
      has_fc_bonus: eb.has_fc_bonus,
      multiplier,
      weighted_spend: eb.buy_volume * multiplier,
      community_total: 0,
    };
  });

  const total = rows.reduce((s, r) => s + r.weighted_spend, 0);
  for (const r of rows) r.community_total = total;

  return rows;
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
      1 + (COALESCE(qr.ref_count, 0) + eb.has_fc_bonus) * $4,
      $5
    ) AS multiplier,
    eb.buy_volume * LEAST(
      1 + (COALESCE(qr.ref_count, 0) + eb.has_fc_bonus) * $4,
      $5
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
