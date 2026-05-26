import { describe, expect, it, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("getAirdropMode", () => {
  it("returns 'prod' when env is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_AIRDROP_MODE", "");
    const { getAirdropMode } = await import("./config");
    expect(getAirdropMode()).toBe("prod");
  });

  it("returns 'prod' for unknown values", async () => {
    vi.stubEnv("NEXT_PUBLIC_AIRDROP_MODE", "staging");
    const { getAirdropMode } = await import("./config");
    expect(getAirdropMode()).toBe("prod");
  });

  it("returns 'test-fast'", async () => {
    vi.stubEnv("NEXT_PUBLIC_AIRDROP_MODE", "test-fast");
    const { getAirdropMode } = await import("./config");
    expect(getAirdropMode()).toBe("test-fast");
  });

  it("returns 'test-full'", async () => {
    vi.stubEnv("NEXT_PUBLIC_AIRDROP_MODE", "test-full");
    const { getAirdropMode } = await import("./config");
    expect(getAirdropMode()).toBe("test-full");
  });
});

describe("getAirdropConfig", () => {
  it("returns PROD config with static dates for prod mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_AIRDROP_MODE", "");
    const { getAirdropConfig } = await import("./config");
    const config = getAirdropConfig();
    expect(config.POOL_AMOUNT).toBe(200_000);
    expect(config.CLAIM_WINDOW_DAYS).toBe(30);
    expect(config.CLAIM_WINDOW_SECONDS).toBeUndefined();
  });

  it("returns test-fast config with 5-min window", async () => {
    vi.stubEnv("NEXT_PUBLIC_AIRDROP_MODE", "test-fast");
    const { getAirdropConfig } = await import("./config");
    const now = new Date("2026-06-01T12:00:00Z");
    const config = getAirdropConfig(now);
    expect(config.POOL_AMOUNT).toBe(10);
    expect(config.CLAIM_WINDOW_SECONDS).toBe(60);
    expect(config.CLAIM_WINDOW_DAYS).toBeUndefined();
    expect(config.CAMPAIGN_START.getTime()).toBe(now.getTime() - 60_000);
    expect(config.CAMPAIGN_END.getTime()).toBe(now.getTime() + 4 * 60_000);
  });

  it("returns test-full config with 30-min window", async () => {
    vi.stubEnv("NEXT_PUBLIC_AIRDROP_MODE", "test-full");
    const { getAirdropConfig } = await import("./config");
    const now = new Date("2026-06-01T12:00:00Z");
    const config = getAirdropConfig(now);
    expect(config.POOL_AMOUNT).toBe(100);
    expect(config.CLAIM_WINDOW_SECONDS).toBe(180);
    expect(config.MIN_REFERRAL_THRESHOLD).toBe(5);
    expect(config.CAMPAIGN_END.getTime()).toBe(now.getTime() + 29 * 60_000);
  });

  it("builds fresh test configs per call — no frozen-at-import bug", async () => {
    vi.stubEnv("NEXT_PUBLIC_AIRDROP_MODE", "test-full");
    const { getAirdropConfig } = await import("./config");
    const t1 = new Date("2026-06-01T12:00:00Z");
    const t2 = new Date("2026-06-01T12:05:00Z");
    const config1 = getAirdropConfig(t1);
    const config2 = getAirdropConfig(t2);
    expect(config2.CAMPAIGN_END.getTime()).toBe(t2.getTime() + 29 * 60_000);
    expect(config2.CAMPAIGN_END.getTime()).not.toBe(config1.CAMPAIGN_END.getTime());
    expect(config2.CAMPAIGN_END.getTime() - config1.CAMPAIGN_END.getTime()).toBe(5 * 60_000);
  });
});

describe("getClaimWindowSeconds", () => {
  it("returns CLAIM_WINDOW_SECONDS when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_AIRDROP_MODE", "test-fast");
    const { getAirdropConfig, getClaimWindowSeconds } = await import("./config");
    const config = getAirdropConfig(new Date());
    expect(getClaimWindowSeconds(config)).toBe(60);
  });

  it("converts CLAIM_WINDOW_DAYS to seconds for PROD", async () => {
    vi.stubEnv("NEXT_PUBLIC_AIRDROP_MODE", "");
    const { getAirdropConfig, getClaimWindowSeconds } = await import("./config");
    const config = getAirdropConfig();
    expect(getClaimWindowSeconds(config)).toBe(30 * 86400);
  });

  it("throws when neither field is set", async () => {
    const { getClaimWindowSeconds } = await import("./config");
    const bad = { POOL_AMOUNT: 0 } as Parameters<typeof getClaimWindowSeconds>[0];
    expect(() => getClaimWindowSeconds(bad)).toThrow(
      "AirdropConfig must specify CLAIM_WINDOW_DAYS or CLAIM_WINDOW_SECONDS",
    );
  });

  it("prefers CLAIM_WINDOW_SECONDS over CLAIM_WINDOW_DAYS when both set", async () => {
    const { getClaimWindowSeconds } = await import("./config");
    const config = { CLAIM_WINDOW_SECONDS: 120, CLAIM_WINDOW_DAYS: 7 } as Parameters<typeof getClaimWindowSeconds>[0];
    expect(getClaimWindowSeconds(config)).toBe(120);
  });
});
