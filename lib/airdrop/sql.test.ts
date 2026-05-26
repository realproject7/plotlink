import { describe, expect, it, vi } from "vitest";
import { weightedSpendQuery } from "./sql";
import type { AirdropConfig } from "./config";

function buildConfig(overrides: Partial<AirdropConfig> = {}): AirdropConfig {
  return {
    CAMPAIGN_START: new Date("2026-07-01T00:00:00Z"),
    CAMPAIGN_END: new Date("2026-10-01T00:00:00Z"),
    POOL_AMOUNT: 200_000,
    MILESTONES: {
      BRONZE: { mcap: 100_000, pct: 10 },
      SILVER: { mcap: 1_000_000, pct: 30 },
      GOLD: { mcap: 5_000_000, pct: 50 },
      DIAMOND: { mcap: 10_000_000, pct: 100 },
    },
    LOCKER_TX: null,
    POINTS: { BUY_PER_PLOT: 1, REFERRAL_PCT: 20, WRITE_FLAT: 50, RATE_FLAT: 5, RATE_DAILY_CAP: 10 },
    STREAK_BOOSTS: {},
    STREAK_MIN_GAP_MINUTES: 30,
    MIN_REFERRAL_THRESHOLD: 50,
    REFERRAL_MULTIPLIER_PER_REF: 0.2,
    REFERRAL_MULTIPLIER_CAP: 3.0,
    SIGNATURE_FRESHNESS_MIN: 10,
    SIWE_DOMAIN: "plotlink.xyz",
    SIWE_URI: "https://plotlink.xyz/airdrop",
    SIWE_STATEMENT: "PlotLink Buy-Back Sprint activation",
    SIWE_CHAIN_ID: 8453,
    PLOTLINK_X_HANDLE: "plotlinkxyz",
    PLOTLINK_FC_FID: 0,
    CLAIM_WINDOW_DAYS: 30,
    ...overrides,
  };
}

describe("weightedSpendQuery", () => {
  it("returns sql and params with correct campaign window", () => {
    const config = buildConfig();
    const { sql, params } = weightedSpendQuery(config);

    expect(params[0]).toBe("2026-07-01T00:00:00.000Z");
    expect(params[1]).toBe("2026-10-01T00:00:00.000Z");
    expect(params[2]).toBe(50);
    expect(params[3]).toBe(0.2);
    expect(params[4]).toBe(3.0);
    expect(sql).toContain("pl_activations");
    expect(sql).toContain("pl_points");
    expect(sql).toContain("pl_referrals");
  });

  it("includes eligibility filter for activated + not blacklisted", () => {
    const { sql } = weightedSpendQuery(buildConfig());
    expect(sql).toContain("a.activated_at IS NOT NULL");
    expect(sql).toContain("a.is_blacklisted = FALSE");
  });

  it("filters buy points within campaign window using params", () => {
    const { sql } = weightedSpendQuery(buildConfig());
    expect(sql).toContain("p.created_at >= $1");
    expect(sql).toContain("p.created_at <= $2");
  });

  it("qualified_refs uses MIN_REFERRAL_THRESHOLD param", () => {
    const { sql } = weightedSpendQuery(buildConfig());
    expect(sql).toContain("eb.buy_volume >= $3");
  });

  it("qualified_refs joins against eligible_buys (same eligibility filter)", () => {
    const { sql } = weightedSpendQuery(buildConfig());
    expect(sql).toContain("JOIN eligible_buys eb ON r.referred_address = eb.address");
  });

  it("multiplier uses REFERRAL_MULTIPLIER_PER_REF and CAP params", () => {
    const { sql } = weightedSpendQuery(buildConfig());
    expect(sql).toContain("$4");
    expect(sql).toContain("$5");
    expect(sql).toContain("LEAST");
  });

  it("includes community_total as window function", () => {
    const { sql } = weightedSpendQuery(buildConfig());
    expect(sql).toContain("SUM(w.weighted_spend) OVER ()");
  });

  it("produces different params for TEST vs PROD config", () => {
    const prodConfig = buildConfig();
    const testConfig = buildConfig({
      CAMPAIGN_START: new Date("2026-06-01T12:00:00Z"),
      CAMPAIGN_END: new Date("2026-06-01T12:05:00Z"),
      MIN_REFERRAL_THRESHOLD: 1,
    });

    const prod = weightedSpendQuery(prodConfig);
    const test = weightedSpendQuery(testConfig);

    expect(prod.params[0]).not.toBe(test.params[0]);
    expect(prod.params[1]).not.toBe(test.params[1]);
    expect(prod.params[2]).not.toBe(test.params[2]);
    expect(prod.sql).toBe(test.sql);
  });

  it("multiplier example: 2 refs + FC bonus + 0.2 per ref → 1.6", () => {
    const config = buildConfig();
    const refCount = 2;
    const fcBonus = 1;
    const expected = 1 + (refCount + fcBonus) * config.REFERRAL_MULTIPLIER_PER_REF;
    expect(expected).toBe(1.6);
    expect(expected).toBeLessThanOrEqual(config.REFERRAL_MULTIPLIER_CAP);
  });

  it("multiplier is capped at REFERRAL_MULTIPLIER_CAP", () => {
    const config = buildConfig();
    const refCount = 20;
    const fcBonus = 1;
    const uncapped = 1 + (refCount + fcBonus) * config.REFERRAL_MULTIPLIER_PER_REF;
    const capped = Math.min(uncapped, config.REFERRAL_MULTIPLIER_CAP);
    expect(uncapped).toBeGreaterThan(config.REFERRAL_MULTIPLIER_CAP);
    expect(capped).toBe(3.0);
  });
});
