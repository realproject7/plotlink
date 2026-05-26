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

  const sql = `SELECT * FROM weighted_spend($1::TIMESTAMPTZ, $2::TIMESTAMPTZ, $3::NUMERIC, $4::NUMERIC, $5::NUMERIC)`;

  return { sql, params };
}
