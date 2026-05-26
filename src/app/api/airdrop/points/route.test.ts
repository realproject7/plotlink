// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockPoints = vi.fn();
const mockAllPoints = vi.fn();
const mockStreak = vi.fn();
const mockRefCode = vi.fn();
const mockReferredBy = vi.fn();
const mockRefCount = vi.fn();

vi.mock("../../../../../lib/supabase", () => ({
  createServerClient: () => ({
    from: (table: string) => {
      if (table === "pl_points") {
        return {
          select: (cols: string) => {
            if (cols.includes("action")) return { eq: () => mockPoints() };
            return mockAllPoints();
          },
        };
      }
      if (table === "pl_streaks") return { select: () => ({ eq: () => ({ single: mockStreak }) }) };
      if (table === "pl_referral_codes") return { select: () => ({ eq: () => ({ single: mockRefCode }) }) };
      if (table === "pl_referrals") {
        return {
          select: (cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count) return { eq: mockRefCount };
            return { eq: () => ({ single: mockReferredBy }) };
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
  }),
}));

import { GET } from "./route";

describe("GET /api/airdrop/points", () => {
  it("returns deprecated shape with buy_volume_plot + deprecation headers", async () => {
    mockPoints.mockResolvedValue({ data: [{ action: "buy", points: 100 }] });
    mockAllPoints.mockResolvedValue({ data: [{ points: 100 }, { points: 200 }] });
    mockStreak.mockResolvedValue({ data: null });
    mockRefCode.mockResolvedValue({ data: { code: "mycode", is_farcaster_username: false } });
    mockReferredBy.mockResolvedValue({ data: null });
    mockRefCount.mockResolvedValue({ count: 3 });

    const req = new NextRequest("http://localhost/api/airdrop/points?address=0xabc");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.address).toBe("0xabc");
    expect(data.buy_volume_plot).toBeDefined();
    expect(data.fetched_at).toBeDefined();
    expect(data.totalPoints).toBeDefined();
    expect(data.referral.code).toBe("mycode");

    expect(res.headers.get("Deprecation")).toBe("true");
    expect(res.headers.get("Link")).toContain("/api/airdrop/projection");
  });

  it("handles non-existent address gracefully", async () => {
    mockPoints.mockResolvedValue({ data: [] });
    mockAllPoints.mockResolvedValue({ data: [] });
    mockStreak.mockResolvedValue({ data: null });
    mockRefCode.mockResolvedValue({ data: null });
    mockReferredBy.mockResolvedValue({ data: null });
    mockRefCount.mockResolvedValue({ count: 0 });

    const req = new NextRequest("http://localhost/api/airdrop/points?address=0xnone");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalPoints).toBe(0);
    expect(data.buy_volume_plot).toBe(0);
  });

  it("returns 400 when address missing", async () => {
    const req = new NextRequest("http://localhost/api/airdrop/points");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
