/**
 * Airdrop campaign configuration (#879)
 *
 * Switch between test/prod via NEXT_PUBLIC_AIRDROP_MODE env var.
 * Test mode uses small pool + low milestones for 3-day test runs.
 */

export interface Milestone {
  readonly mcap: number;
  readonly pct: number;
}

export interface AirdropConfig {
  readonly CAMPAIGN_START: Date;
  readonly CAMPAIGN_END: Date;
  readonly POOL_AMOUNT: number;
  readonly MILESTONES: {
    readonly BRONZE: Milestone;
    readonly SILVER: Milestone;
    readonly GOLD: Milestone;
    readonly DIAMOND: Milestone;
  };
  readonly LOCKER_ID: string | null;
  readonly POINTS: {
    readonly BUY_PER_PLOT: number;
    readonly REFERRAL_PCT: number;
    readonly WRITE_FLAT: number;
    readonly RATE_FLAT: number;
    readonly RATE_DAILY_CAP: number;
  };
  readonly STREAK_BOOSTS: Record<number, number>;
  readonly STREAK_MIN_GAP_MINUTES: number;
}

export type MilestoneTier = keyof AirdropConfig["MILESTONES"];

const POINTS = {
  BUY_PER_PLOT: 1,
  REFERRAL_PCT: 20,
  WRITE_FLAT: 50,
  RATE_FLAT: 5,
  RATE_DAILY_CAP: 10,
} as const;

const STREAK_BOOSTS: Record<number, number> = {
  7: 0.05,
  14: 0.10,
  30: 0.20,
  50: 0.30,
  100: 0.50,
};

const STREAK_MIN_GAP_MINUTES = 30;

const TEST_CONFIG: AirdropConfig = {
  CAMPAIGN_START: new Date("2026-04-27"),
  CAMPAIGN_END: new Date("2026-04-30"),       // start + 3 days
  POOL_AMOUNT: 10,                            // 10 PLOT
  MILESTONES: {
    BRONZE: { mcap: 7_000, pct: 10 },
    SILVER: { mcap: 10_000, pct: 30 },
    GOLD: { mcap: 35_000, pct: 50 },
    DIAMOND: { mcap: 50_000, pct: 100 },
  },
  LOCKER_ID: null,
  POINTS,
  STREAK_BOOSTS,
  STREAK_MIN_GAP_MINUTES,
};

const PROD_CONFIG: AirdropConfig = {
  CAMPAIGN_START: new Date("2026-07-01"),
  CAMPAIGN_END: new Date("2027-01-01"),       // start + 6 months
  POOL_AMOUNT: 50_000,
  MILESTONES: {
    BRONZE: { mcap: 1_000_000, pct: 10 },
    SILVER: { mcap: 10_000_000, pct: 30 },
    GOLD: { mcap: 50_000_000, pct: 50 },
    DIAMOND: { mcap: 100_000_000, pct: 100 },
  },
  LOCKER_ID: null,
  POINTS,
  STREAK_BOOSTS,
  STREAK_MIN_GAP_MINUTES,
};

const mode = process.env.NEXT_PUBLIC_AIRDROP_MODE ?? "prod";

export const AIRDROP_CONFIG: AirdropConfig =
  mode === "test" ? TEST_CONFIG : PROD_CONFIG;
