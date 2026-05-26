import { describe, expect, it } from "vitest";
import { weightedSpendQuery, computeWeightedSpend } from "./sql";
import type { AirdropConfig } from "./config";
import type { Activation, BuyPoint, Referral } from "./sql";

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
  it("returns parameterized sql with campaign window and config values", () => {
    const config = buildConfig();
    const { sql, params } = weightedSpendQuery(config);

    expect(params).toEqual([
      "2026-07-01T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
      50, 0.2, 3.0,
    ]);
    expect(sql).toContain("pl_activations");
    expect(sql).toContain("activated_at IS NOT NULL");
    expect(sql).toContain("is_blacklisted = FALSE");
    expect(sql).toContain("SUM(w.weighted_spend) OVER ()");
  });

  it("same SQL structure for TEST vs PROD, different params", () => {
    const prod = weightedSpendQuery(buildConfig());
    const test = weightedSpendQuery(buildConfig({
      CAMPAIGN_START: new Date("2026-06-01T12:00:00Z"),
      CAMPAIGN_END: new Date("2026-06-01T12:05:00Z"),
      MIN_REFERRAL_THRESHOLD: 1,
    }));
    expect(prod.sql).toBe(test.sql);
    expect(prod.params).not.toEqual(test.params);
  });
});

describe("computeWeightedSpend", () => {
  const config = buildConfig();
  const inCampaign = "2026-08-01T00:00:00Z";

  it("100 PLOT + 2 qualified refs + FC bonus → multiplier 1.6, weighted 160", () => {
    const activations: Activation[] = [
      { address: "alice", activated_at: "2026-07-01", is_blacklisted: false, fid: 123 },
      { address: "ref1", activated_at: "2026-07-01", is_blacklisted: false, fid: null },
      { address: "ref2", activated_at: "2026-07-01", is_blacklisted: false, fid: null },
    ];
    const buys: BuyPoint[] = [
      { address: "alice", action: "buy", points: 100, created_at: inCampaign },
      { address: "ref1", action: "buy", points: 60, created_at: inCampaign },
      { address: "ref2", action: "buy", points: 80, created_at: inCampaign },
    ];
    const refs: Referral[] = [
      { referrer_address: "alice", referred_address: "ref1" },
      { referrer_address: "alice", referred_address: "ref2" },
    ];

    const rows = computeWeightedSpend(config, activations, buys, refs);
    const alice = rows.find(r => r.address === "alice")!;

    expect(alice.buy_volume).toBe(100);
    expect(alice.qualified_refs).toBe(2);
    expect(alice.has_fc_bonus).toBe(1);
    expect(alice.multiplier).toBe(1.6);
    expect(alice.weighted_spend).toBe(160);
  });

  it("excludes blacklisted wallets from results", () => {
    const activations: Activation[] = [
      { address: "good", activated_at: "2026-07-01", is_blacklisted: false, fid: null },
      { address: "bad", activated_at: "2026-07-01", is_blacklisted: true, fid: null },
    ];
    const buys: BuyPoint[] = [
      { address: "good", action: "buy", points: 100, created_at: inCampaign },
      { address: "bad", action: "buy", points: 100, created_at: inCampaign },
    ];

    const rows = computeWeightedSpend(config, activations, buys, []);
    expect(rows).toHaveLength(1);
    expect(rows[0].address).toBe("good");
  });

  it("excludes non-activated wallets from results", () => {
    const activations: Activation[] = [
      { address: "active", activated_at: "2026-07-01", is_blacklisted: false, fid: null },
      { address: "pending", activated_at: null, is_blacklisted: false, fid: null },
    ];
    const buys: BuyPoint[] = [
      { address: "active", action: "buy", points: 100, created_at: inCampaign },
      { address: "pending", action: "buy", points: 100, created_at: inCampaign },
    ];

    const rows = computeWeightedSpend(config, activations, buys, []);
    expect(rows).toHaveLength(1);
    expect(rows[0].address).toBe("active");
  });

  it("qualified_refs excludes non-activated referees", () => {
    const activations: Activation[] = [
      { address: "alice", activated_at: "2026-07-01", is_blacklisted: false, fid: null },
      { address: "bob", activated_at: "2026-07-01", is_blacklisted: false, fid: null },
      { address: "charlie", activated_at: null, is_blacklisted: false, fid: null },
    ];
    const buys: BuyPoint[] = [
      { address: "alice", action: "buy", points: 100, created_at: inCampaign },
      { address: "bob", action: "buy", points: 60, created_at: inCampaign },
      { address: "charlie", action: "buy", points: 60, created_at: inCampaign },
    ];
    const refs: Referral[] = [
      { referrer_address: "alice", referred_address: "bob" },
      { referrer_address: "alice", referred_address: "charlie" },
    ];

    const rows = computeWeightedSpend(config, activations, buys, refs);
    const alice = rows.find(r => r.address === "alice")!;
    expect(alice.qualified_refs).toBe(1);
  });

  it("qualified_refs excludes blacklisted referees", () => {
    const activations: Activation[] = [
      { address: "alice", activated_at: "2026-07-01", is_blacklisted: false, fid: null },
      { address: "dave", activated_at: "2026-07-01", is_blacklisted: true, fid: null },
    ];
    const buys: BuyPoint[] = [
      { address: "alice", action: "buy", points: 100, created_at: inCampaign },
      { address: "dave", action: "buy", points: 60, created_at: inCampaign },
    ];
    const refs: Referral[] = [
      { referrer_address: "alice", referred_address: "dave" },
    ];

    const rows = computeWeightedSpend(config, activations, buys, refs);
    const alice = rows.find(r => r.address === "alice")!;
    expect(alice.qualified_refs).toBe(0);
  });

  it("qualified_refs excludes under-threshold referees (49 < 50)", () => {
    const activations: Activation[] = [
      { address: "alice", activated_at: "2026-07-01", is_blacklisted: false, fid: null },
      { address: "low", activated_at: "2026-07-01", is_blacklisted: false, fid: null },
      { address: "high", activated_at: "2026-07-01", is_blacklisted: false, fid: null },
    ];
    const buys: BuyPoint[] = [
      { address: "alice", action: "buy", points: 100, created_at: inCampaign },
      { address: "low", action: "buy", points: 49, created_at: inCampaign },
      { address: "high", action: "buy", points: 50, created_at: inCampaign },
    ];
    const refs: Referral[] = [
      { referrer_address: "alice", referred_address: "low" },
      { referrer_address: "alice", referred_address: "high" },
    ];

    const rows = computeWeightedSpend(config, activations, buys, refs);
    const alice = rows.find(r => r.address === "alice")!;
    expect(alice.qualified_refs).toBe(1);
  });

  it("TEST vs PROD campaign windows produce different buy_volume", () => {
    const prodConfig = buildConfig();
    const testConfig = buildConfig({
      CAMPAIGN_START: new Date("2026-06-01T00:00:00Z"),
      CAMPAIGN_END: new Date("2026-06-01T00:05:00Z"),
    });

    const activations: Activation[] = [
      { address: "alice", activated_at: "2026-06-01", is_blacklisted: false, fid: null },
    ];
    const buys: BuyPoint[] = [
      { address: "alice", action: "buy", points: 50, created_at: "2026-06-01T00:02:00Z" },
      { address: "alice", action: "buy", points: 75, created_at: "2026-08-01T00:00:00Z" },
    ];

    const testRows = computeWeightedSpend(testConfig, activations, buys, []);
    const prodRows = computeWeightedSpend(prodConfig, activations, buys, []);

    expect(testRows[0].buy_volume).toBe(50);
    expect(prodRows[0].buy_volume).toBe(75);
  });

  it("community_total sums all weighted_spend", () => {
    const activations: Activation[] = [
      { address: "a", activated_at: "2026-07-01", is_blacklisted: false, fid: null },
      { address: "b", activated_at: "2026-07-01", is_blacklisted: false, fid: null },
    ];
    const buys: BuyPoint[] = [
      { address: "a", action: "buy", points: 100, created_at: inCampaign },
      { address: "b", action: "buy", points: 200, created_at: inCampaign },
    ];

    const rows = computeWeightedSpend(config, activations, buys, []);
    expect(rows[0].community_total).toBe(300);
    expect(rows[1].community_total).toBe(300);
  });

  it("multiplier is capped at REFERRAL_MULTIPLIER_CAP", () => {
    const activations: Activation[] = [
      { address: "whale", activated_at: "2026-07-01", is_blacklisted: false, fid: 1 },
      ...Array.from({ length: 20 }, (_, i) => ({
        address: `ref${i}`, activated_at: "2026-07-01" as string | null, is_blacklisted: false, fid: null,
      })),
    ];
    const buys: BuyPoint[] = [
      { address: "whale", action: "buy", points: 100, created_at: inCampaign },
      ...Array.from({ length: 20 }, (_, i) => ({
        address: `ref${i}`, action: "buy", points: 60, created_at: inCampaign,
      })),
    ];
    const refs: Referral[] = Array.from({ length: 20 }, (_, i) => ({
      referrer_address: "whale", referred_address: `ref${i}`,
    }));

    const rows = computeWeightedSpend(config, activations, buys, refs);
    const whale = rows.find(r => r.address === "whale")!;
    expect(whale.multiplier).toBe(3.0);
    expect(whale.weighted_spend).toBe(300);
  });
});
