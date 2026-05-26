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
  readonly LOCKER_TX: string | null;
  readonly POINTS: {
    readonly BUY_PER_PLOT: number;
    readonly REFERRAL_PCT: number;
    readonly WRITE_FLAT: number;
    readonly RATE_FLAT: number;
    readonly RATE_DAILY_CAP: number;
  };
  readonly STREAK_BOOSTS: Record<number, number>;
  readonly STREAK_MIN_GAP_MINUTES: number;
  readonly MIN_REFERRAL_THRESHOLD: number;
  readonly REFERRAL_MULTIPLIER_PER_REF: number;
  readonly REFERRAL_MULTIPLIER_CAP: number;
  readonly SIGNATURE_FRESHNESS_MIN: number;
  readonly SIWE_DOMAIN: string;
  readonly SIWE_URI: string;
  readonly SIWE_STATEMENT: string;
  readonly SIWE_CHAIN_ID: number;
  readonly PLOTLINK_X_HANDLE: string;
  readonly PLOTLINK_FC_FID: number;
  readonly CLAIM_WINDOW_DAYS?: number;
  readonly CLAIM_WINDOW_SECONDS?: number;
}

export type MilestoneTier = keyof AirdropConfig["MILESTONES"];

export type AirdropMode = "test-fast" | "test-full" | "prod";

const POINTS = {
  BUY_PER_PLOT: 1,
  REFERRAL_PCT: 20,
  WRITE_FLAT: 50,
  RATE_FLAT: 5,
  RATE_DAILY_CAP: 10,
} as const;

const STREAK_MIN_GAP_MINUTES = 30;

const SIWE_COMMON = {
  SIWE_DOMAIN: "plotlink.xyz",
  SIWE_URI: "https://plotlink.xyz/airdrop",
  SIWE_STATEMENT: "PlotLink Buy-Back Sprint activation",
  SIWE_CHAIN_ID: 8453,
  PLOTLINK_X_HANDLE: "plotlinkxyz",
  PLOTLINK_FC_FID: 0, // pending operator — T0.1 action item #2
} as const;

const PROD_CONFIG: AirdropConfig = {
  CAMPAIGN_START: new Date("2026-07-01"),
  CAMPAIGN_END: new Date("2026-10-01"),
  POOL_AMOUNT: 200_000,
  MILESTONES: {
    BRONZE: { mcap: 100_000, pct: 10 },
    SILVER: { mcap: 1_000_000, pct: 30 },
    GOLD: { mcap: 5_000_000, pct: 50 },
    DIAMOND: { mcap: 10_000_000, pct: 100 },
  },
  LOCKER_TX: null,
  POINTS,
  STREAK_BOOSTS: {},
  STREAK_MIN_GAP_MINUTES,
  MIN_REFERRAL_THRESHOLD: 50,
  REFERRAL_MULTIPLIER_PER_REF: 0.2,
  REFERRAL_MULTIPLIER_CAP: 3.0,
  SIGNATURE_FRESHNESS_MIN: 10,
  CLAIM_WINDOW_DAYS: 30,
  ...SIWE_COMMON,
};

function buildTestFastConfig(now: Date): AirdropConfig {
  return {
    CAMPAIGN_START: new Date(now.getTime() - 60_000),
    CAMPAIGN_END: new Date(now.getTime() + 4 * 60_000),
    POOL_AMOUNT: 10,
    MILESTONES: {
      BRONZE: { mcap: 1, pct: 10 },
      SILVER: { mcap: 10, pct: 30 },
      GOLD: { mcap: 100, pct: 50 },
      DIAMOND: { mcap: 1000, pct: 100 },
    },
    LOCKER_TX: null,
    POINTS,
    STREAK_BOOSTS: {},
    STREAK_MIN_GAP_MINUTES,
    MIN_REFERRAL_THRESHOLD: 1,
    REFERRAL_MULTIPLIER_PER_REF: 0.2,
    REFERRAL_MULTIPLIER_CAP: 3.0,
    SIGNATURE_FRESHNESS_MIN: 10,
    CLAIM_WINDOW_SECONDS: 60,
    ...SIWE_COMMON,
  };
}

function buildTestFullConfig(now: Date): AirdropConfig {
  return {
    CAMPAIGN_START: new Date(now.getTime() - 60_000),
    CAMPAIGN_END: new Date(now.getTime() + 29 * 60_000),
    POOL_AMOUNT: 100,
    MILESTONES: {
      BRONZE: { mcap: 1, pct: 10 },
      SILVER: { mcap: 10, pct: 30 },
      GOLD: { mcap: 100, pct: 50 },
      DIAMOND: { mcap: 1000, pct: 100 },
    },
    LOCKER_TX: null,
    POINTS,
    STREAK_BOOSTS: {},
    STREAK_MIN_GAP_MINUTES,
    MIN_REFERRAL_THRESHOLD: 5,
    REFERRAL_MULTIPLIER_PER_REF: 0.2,
    REFERRAL_MULTIPLIER_CAP: 3.0,
    SIGNATURE_FRESHNESS_MIN: 10,
    CLAIM_WINDOW_SECONDS: 180,
    ...SIWE_COMMON,
  };
}

export function getAirdropMode(): AirdropMode {
  const raw = process.env.NEXT_PUBLIC_AIRDROP_MODE;
  if (raw === "test-fast") return "test-fast";
  if (raw === "test-full") return "test-full";
  return "prod";
}

export function getAirdropConfig(now: Date = new Date()): AirdropConfig {
  switch (getAirdropMode()) {
    case "test-fast": return buildTestFastConfig(now);
    case "test-full": return buildTestFullConfig(now);
    default: return PROD_CONFIG;
  }
}

export function getClaimWindowSeconds(config: AirdropConfig): number {
  if (config.CLAIM_WINDOW_SECONDS !== undefined) return config.CLAIM_WINDOW_SECONDS;
  if (config.CLAIM_WINDOW_DAYS !== undefined) return config.CLAIM_WINDOW_DAYS * 86400;
  throw new Error("AirdropConfig must specify CLAIM_WINDOW_DAYS or CLAIM_WINDOW_SECONDS");
}

export const AIRDROP_CONFIG: AirdropConfig =
  getAirdropMode() === "prod" ? PROD_CONFIG : getAirdropConfig(new Date());
