// @vitest-environment node
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { weightedSpendQuery } from "./sql";
import type { AirdropConfig } from "./config";

let db: PGlite;

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

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE TABLE pl_activations (
      address TEXT PRIMARY KEY,
      fid BIGINT,
      activated_at TIMESTAMPTZ,
      is_blacklisted BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE TABLE pl_points (
      id SERIAL PRIMARY KEY,
      address TEXT NOT NULL,
      action TEXT NOT NULL,
      points NUMERIC NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE pl_referrals (
      id SERIAL PRIMARY KEY,
      referrer_address TEXT NOT NULL,
      referred_address TEXT NOT NULL
    );
  `);
  const migrationSql = await import("fs").then(fs =>
    fs.readFileSync(new URL("../../supabase/migrations/00040_weighted_spend_function.sql", import.meta.url), "utf-8")
  );
  await db.exec(migrationSql.replace(/GRANT[^;]*;/, ""));
});

afterAll(async () => {
  await db.close();
});

async function resetFixtures() {
  await db.exec("DELETE FROM pl_referrals; DELETE FROM pl_points; DELETE FROM pl_activations;");
}

async function runQuery(config: AirdropConfig) {
  const { sql, params } = weightedSpendQuery(config);
  const result = await db.query(sql, params);
  return result.rows as Array<{
    address: string;
    buy_volume: number;
    qualified_refs: number;
    has_fc_bonus: number;
    multiplier: number;
    weighted_spend: number;
    community_total: number;
  }>;
}

const IN_CAMPAIGN = "2026-08-01T00:00:00Z";
const config = buildConfig();

describe("weightedSpendQuery against PGlite", () => {
  it("100 PLOT + 2 qualified refs + FC bonus → multiplier 1.6, weighted 160", async () => {
    await resetFixtures();
    await db.exec(`
      INSERT INTO pl_activations (address, fid, activated_at) VALUES
        ('alice', 123, '2026-07-01'),
        ('ref1', NULL, '2026-07-01'),
        ('ref2', NULL, '2026-07-01');
      INSERT INTO pl_points (address, action, points, created_at) VALUES
        ('alice', 'buy', 100, '${IN_CAMPAIGN}'),
        ('ref1', 'buy', 60, '${IN_CAMPAIGN}'),
        ('ref2', 'buy', 80, '${IN_CAMPAIGN}');
      INSERT INTO pl_referrals (referrer_address, referred_address) VALUES
        ('alice', 'ref1'),
        ('alice', 'ref2');
    `);

    const rows = await runQuery(config);
    const alice = rows.find(r => r.address === "alice")!;

    expect(Number(alice.buy_volume)).toBe(100);
    expect(Number(alice.qualified_refs)).toBe(2);
    expect(Number(alice.has_fc_bonus)).toBe(1);
    expect(Number(alice.multiplier)).toBeCloseTo(1.6);
    expect(Number(alice.weighted_spend)).toBeCloseTo(160);
  });

  it("excludes blacklisted wallets from results", async () => {
    await resetFixtures();
    await db.exec(`
      INSERT INTO pl_activations (address, activated_at, is_blacklisted) VALUES
        ('good', '2026-07-01', FALSE),
        ('bad', '2026-07-01', TRUE);
      INSERT INTO pl_points (address, action, points, created_at) VALUES
        ('good', 'buy', 100, '${IN_CAMPAIGN}'),
        ('bad', 'buy', 100, '${IN_CAMPAIGN}');
    `);

    const rows = await runQuery(config);
    expect(rows).toHaveLength(1);
    expect(rows[0].address).toBe("good");
  });

  it("excludes non-activated wallets from results", async () => {
    await resetFixtures();
    await db.exec(`
      INSERT INTO pl_activations (address, activated_at) VALUES
        ('active', '2026-07-01'),
        ('pending', NULL);
      INSERT INTO pl_points (address, action, points, created_at) VALUES
        ('active', 'buy', 100, '${IN_CAMPAIGN}'),
        ('pending', 'buy', 100, '${IN_CAMPAIGN}');
    `);

    const rows = await runQuery(config);
    expect(rows).toHaveLength(1);
    expect(rows[0].address).toBe("active");
  });

  it("qualified_refs excludes non-activated referees", async () => {
    await resetFixtures();
    await db.exec(`
      INSERT INTO pl_activations (address, activated_at) VALUES
        ('alice', '2026-07-01'),
        ('bob', '2026-07-01'),
        ('charlie', NULL);
      INSERT INTO pl_points (address, action, points, created_at) VALUES
        ('alice', 'buy', 100, '${IN_CAMPAIGN}'),
        ('bob', 'buy', 60, '${IN_CAMPAIGN}'),
        ('charlie', 'buy', 60, '${IN_CAMPAIGN}');
      INSERT INTO pl_referrals (referrer_address, referred_address) VALUES
        ('alice', 'bob'),
        ('alice', 'charlie');
    `);

    const rows = await runQuery(config);
    const alice = rows.find(r => r.address === "alice")!;
    expect(Number(alice.qualified_refs)).toBe(1);
  });

  it("qualified_refs excludes blacklisted referees", async () => {
    await resetFixtures();
    await db.exec(`
      INSERT INTO pl_activations (address, activated_at, is_blacklisted) VALUES
        ('alice', '2026-07-01', FALSE),
        ('dave', '2026-07-01', TRUE);
      INSERT INTO pl_points (address, action, points, created_at) VALUES
        ('alice', 'buy', 100, '${IN_CAMPAIGN}'),
        ('dave', 'buy', 60, '${IN_CAMPAIGN}');
      INSERT INTO pl_referrals (referrer_address, referred_address) VALUES
        ('alice', 'dave');
    `);

    const rows = await runQuery(config);
    const alice = rows.find(r => r.address === "alice")!;
    expect(Number(alice.qualified_refs)).toBe(0);
  });

  it("qualified_refs excludes under-threshold referees (49 < 50)", async () => {
    await resetFixtures();
    await db.exec(`
      INSERT INTO pl_activations (address, activated_at) VALUES
        ('alice', '2026-07-01'),
        ('low', '2026-07-01'),
        ('high', '2026-07-01');
      INSERT INTO pl_points (address, action, points, created_at) VALUES
        ('alice', 'buy', 100, '${IN_CAMPAIGN}'),
        ('low', 'buy', 49, '${IN_CAMPAIGN}'),
        ('high', 'buy', 50, '${IN_CAMPAIGN}');
      INSERT INTO pl_referrals (referrer_address, referred_address) VALUES
        ('alice', 'low'),
        ('alice', 'high');
    `);

    const rows = await runQuery(config);
    const alice = rows.find(r => r.address === "alice")!;
    expect(Number(alice.qualified_refs)).toBe(1);
  });

  it("TEST vs PROD campaign windows produce different buy_volume", async () => {
    await resetFixtures();
    await db.exec(`
      INSERT INTO pl_activations (address, activated_at) VALUES ('alice', '2026-06-01');
      INSERT INTO pl_points (address, action, points, created_at) VALUES
        ('alice', 'buy', 50, '2026-06-01T00:02:00Z'),
        ('alice', 'buy', 75, '${IN_CAMPAIGN}');
    `);

    const testConfig = buildConfig({
      CAMPAIGN_START: new Date("2026-06-01T00:00:00Z"),
      CAMPAIGN_END: new Date("2026-06-01T00:05:00Z"),
    });

    const testRows = await runQuery(testConfig);
    const prodRows = await runQuery(config);

    expect(Number(testRows[0].buy_volume)).toBe(50);
    expect(Number(prodRows[0].buy_volume)).toBe(75);
  });

  it("community_total sums all weighted_spend across rows", async () => {
    await resetFixtures();
    await db.exec(`
      INSERT INTO pl_activations (address, activated_at) VALUES
        ('a', '2026-07-01'),
        ('b', '2026-07-01');
      INSERT INTO pl_points (address, action, points, created_at) VALUES
        ('a', 'buy', 100, '${IN_CAMPAIGN}'),
        ('b', 'buy', 200, '${IN_CAMPAIGN}');
    `);

    const rows = await runQuery(config);
    expect(Number(rows[0].community_total)).toBe(300);
    expect(Number(rows[1].community_total)).toBe(300);
  });

  it("multiplier is capped at REFERRAL_MULTIPLIER_CAP", async () => {
    await resetFixtures();
    const refInserts = Array.from({ length: 20 }, (_, i) =>
      `('ref${i}', '2026-07-01')`
    ).join(",");
    const buyInserts = Array.from({ length: 20 }, (_, i) =>
      `('ref${i}', 'buy', 60, '${IN_CAMPAIGN}')`
    ).join(",");
    const relInserts = Array.from({ length: 20 }, (_, i) =>
      `('whale', 'ref${i}')`
    ).join(",");

    await db.exec(`
      INSERT INTO pl_activations (address, activated_at) VALUES
        ('whale', '2026-07-01'), ${refInserts};
      UPDATE pl_activations SET fid = 1 WHERE address = 'whale';
      INSERT INTO pl_points (address, action, points, created_at) VALUES
        ('whale', 'buy', 100, '${IN_CAMPAIGN}'), ${buyInserts};
      INSERT INTO pl_referrals (referrer_address, referred_address) VALUES ${relInserts};
    `);

    const rows = await runQuery(config);
    const whale = rows.find(r => r.address === "whale")!;
    expect(Number(whale.multiplier)).toBe(3.0);
    expect(Number(whale.weighted_spend)).toBeCloseTo(300);
  });
});
