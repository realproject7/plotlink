// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const mockActivations = vi.fn();
const mockBuys = vi.fn();
const mockReferrals = vi.fn();
const mockActivationSingle = vi.fn();

vi.mock("../../../../../lib/supabase", () => ({
  createServerClient: () => ({
    from: (table: string) => {
      if (table === "pl_activations") {
        return {
          select: (cols: string) => {
            if (cols.includes("activated_at, is_blacklisted") && !cols.includes("fid")) {
              return { eq: () => ({ single: mockActivationSingle }) };
            }
            return mockActivations();
          },
        };
      }
      if (table === "pl_points") {
        return { select: () => ({ eq: () => ({ gte: () => ({ lte: mockBuys }) }) }) };
      }
      if (table === "pl_referrals") {
        return { select: mockReferrals };
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
    MIN_REFERRAL_THRESHOLD: 50,
    REFERRAL_MULTIPLIER_PER_REF: 0.2,
    REFERRAL_MULTIPLIER_CAP: 3.0,
  }),
}));

import { GET } from "./route";

function makeReq(address?: string) {
  const url = address
    ? `http://localhost/api/airdrop/projection?address=${address}`
    : "http://localhost/api/airdrop/projection";
  return new Request(url);
}

function setupMocks(opts: {
  activations?: unknown[];
  buys?: unknown[];
  referrals?: unknown[];
  activationSingle?: unknown;
}) {
  mockActivations.mockReturnValue({ data: opts.activations ?? [] });
  mockBuys.mockResolvedValue({ data: opts.buys ?? [] });
  mockReferrals.mockResolvedValue({ data: opts.referrals ?? [] });
  mockActivationSingle.mockResolvedValue({ data: opts.activationSingle ?? null });
}

describe("GET /api/airdrop/projection", () => {
  it("§4 worked example: 100 PLOT + 2 qualified refs + FC → multiplier 1.6, weighted 160", async () => {
    setupMocks({
      activations: [
        { address: "alice", fid: 123, activated_at: "2026-07-01", is_blacklisted: false },
        { address: "ref1", fid: null, activated_at: "2026-07-01", is_blacklisted: false },
        { address: "ref2", fid: null, activated_at: "2026-07-01", is_blacklisted: false },
      ],
      buys: [
        { address: "alice", action: "buy", points: 100, created_at: "2026-08-01" },
        { address: "ref1", action: "buy", points: 60, created_at: "2026-08-01" },
        { address: "ref2", action: "buy", points: 80, created_at: "2026-08-01" },
      ],
      referrals: [
        { referrer_address: "alice", referred_address: "ref1" },
        { referrer_address: "alice", referred_address: "ref2" },
      ],
    });

    const res = await GET(makeReq("alice"));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.buy_volume).toBe(100);
    expect(data.qualified_refs).toBe(2);
    expect(data.has_fc_bonus).toBe(true);
    expect(data.multiplier).toBeCloseTo(1.6);
    expect(data.weighted_spend).toBeCloseTo(160);

    const ref1Ws = 60 * 1;
    const ref2Ws = 80 * 1;
    const expectedTotal = 160 + ref1Ws + ref2Ws;
    expect(data.community_total).toBeCloseTo(expectedTotal);

    const share = 160 / expectedTotal;
    expect(data.projected_share.bronze).toBeCloseTo(200_000 * 0.10 * share);
    expect(data.projected_share.silver).toBeCloseTo(200_000 * 0.30 * share);
    expect(data.projected_share.gold).toBeCloseTo(200_000 * 0.50 * share);
    expect(data.projected_share.diamond).toBeCloseTo(200_000 * 1.00 * share);
  });

  it("returns zeros for activated wallet with no buys", async () => {
    setupMocks({
      activations: [{ address: "alice", fid: null, activated_at: "2026-07-01", is_blacklisted: false }],
      buys: [],
      activationSingle: { activated_at: "2026-07-01", is_blacklisted: false },
    });

    const res = await GET(makeReq("alice"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.buy_volume).toBe(0);
    expect(data.weighted_spend).toBe(0);
    expect(data.projected_share.diamond).toBe(0);
  });

  it("returns 404 for non-activated wallet", async () => {
    setupMocks({
      activations: [],
      buys: [],
      activationSingle: null,
    });
    const res = await GET(makeReq("0xnone"));
    expect(res.status).toBe(404);
  });

  it("returns 404 for blacklisted wallet", async () => {
    setupMocks({
      activations: [{ address: "bad", fid: null, activated_at: "2026-07-01", is_blacklisted: true }],
      buys: [],
      activationSingle: { activated_at: "2026-07-01", is_blacklisted: true },
    });
    const res = await GET(makeReq("bad"));
    expect(res.status).toBe(404);
  });

  it("includes Cache-Control: public, max-age=30", async () => {
    setupMocks({
      activations: [{ address: "alice", fid: null, activated_at: "2026-07-01", is_blacklisted: false }],
      buys: [],
      activationSingle: { activated_at: "2026-07-01", is_blacklisted: false },
    });
    const res = await GET(makeReq("alice"));
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=30");
  });

  it("returns 400 when address is missing", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });
});
