// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const mockPriceSingle = vi.fn();
const mockActivationCount = vi.fn();
const mockEligibleCount = vi.fn();

vi.mock("../../../../../lib/supabase", () => ({
  createServerClient: () => ({
    from: (table: string) => {
      if (table === "pl_daily_prices") return { select: () => ({ order: () => ({ limit: () => ({ single: mockPriceSingle }) }) }) };
      if (table === "pl_activations") {
        return {
          select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count) {
              return { not: () => ({ eq: mockEligibleCount, count: mockActivationCount.mockReturnValue({ count: 10 }) }) };
            }
            return {};
          },
        };
      }
      return {};
    },
  }),
}));
vi.mock("../../../../../lib/airdrop/config", () => ({
  getAirdropConfig: () => ({
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
    SIWE_DOMAIN: "plotlink.xyz",
    SIWE_URI: "https://plotlink.xyz/airdrop",
    SIWE_STATEMENT: "PlotLink Buy-Back Sprint activation",
    SIWE_CHAIN_ID: 8453,
    PLOTLINK_X_HANDLE: "plotlinkxyz",
    PLOTLINK_FC_FID: 0,
  }),
}));
vi.mock("../../../../../lib/usd-price", () => ({ getPlotUsdPrice: () => Promise.resolve(0.037) }));

import { GET } from "./route";

describe("GET /api/airdrop/status", () => {
  it("returns v5 shape with milestones + activation counts + env_check", async () => {
    mockPriceSingle.mockResolvedValue({ data: { price_usd: 0.037, mcap_usd: 37000 } });
    mockActivationCount.mockResolvedValue({ count: 15 });
    mockEligibleCount.mockResolvedValue({ count: 12 });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.milestones).toBeDefined();
    expect(data.milestones.bronze).toBeDefined();
    expect(data.milestones.diamond).toBeDefined();
    expect(data.poolAmount).toBe(200_000);
    expect(typeof data.env_check.all_present).toBe("boolean");
  });

  it("env_check.all_present is false when required env vars missing", async () => {
    mockPriceSingle.mockResolvedValue({ data: null });
    mockActivationCount.mockResolvedValue({ count: 0 });
    mockEligibleCount.mockResolvedValue({ count: 0 });

    const res = await GET();
    const data = await res.json();
    expect(data.env_check.all_present).toBe(false);
  });
});
