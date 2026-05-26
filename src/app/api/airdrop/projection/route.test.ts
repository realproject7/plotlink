// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const mockActivationSingle = vi.fn();
const mockEligible = vi.fn();
const mockBuys = vi.fn();
const mockReferrals = vi.fn();

vi.mock("../../../../../lib/supabase", () => ({
  createServerClient: () => ({
    from: (table: string) => {
      if (table === "pl_activations") {
        return {
          select: () => ({
            eq: () => ({ single: mockActivationSingle }),
            not: () => ({ eq: mockEligible }),
          }),
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
  activation?: unknown;
  eligible?: unknown[];
  buys?: unknown[];
  referrals?: unknown[];
}) {
  mockActivationSingle.mockResolvedValue({ data: opts.activation ?? null });
  mockEligible.mockResolvedValue({ data: opts.eligible ?? [] });
  mockBuys.mockResolvedValue({ data: opts.buys ?? [] });
  mockReferrals.mockResolvedValue({ data: opts.referrals ?? [] });
}

describe("GET /api/airdrop/projection", () => {
  it("returns projected shares for activated wallet with buys", async () => {
    setupMocks({
      activation: { address: "alice", fid: 123, activated_at: "2026-07-01", is_blacklisted: false },
      eligible: [
        { address: "alice", fid: 123 },
        { address: "bob", fid: null },
      ],
      buys: [
        { address: "alice", points: 100 },
        { address: "bob", points: 200 },
      ],
      referrals: [],
    });

    const res = await GET(makeReq("alice"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.buy_volume).toBe(100);
    expect(data.has_fc_bonus).toBe(true);
    expect(data.multiplier).toBe(1.2);
    expect(data.weighted_spend).toBeCloseTo(120);
    expect(data.community_total).toBeCloseTo(320);
    expect(data.projected_share.diamond).toBeCloseTo(200_000 * (120 / 320));
  });

  it("returns zeros for activated wallet with no buys", async () => {
    setupMocks({
      activation: { address: "alice", fid: null, activated_at: "2026-07-01", is_blacklisted: false },
      eligible: [{ address: "alice", fid: null }],
      buys: [],
      referrals: [],
    });

    const res = await GET(makeReq("alice"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.buy_volume).toBe(0);
    expect(data.weighted_spend).toBe(0);
    expect(data.projected_share.diamond).toBe(0);
  });

  it("returns 404 for non-activated wallet", async () => {
    setupMocks({ activation: null });
    const res = await GET(makeReq("0xnone"));
    expect(res.status).toBe(404);
  });

  it("returns 404 for blacklisted wallet", async () => {
    setupMocks({
      activation: { address: "bad", fid: null, activated_at: "2026-07-01", is_blacklisted: true },
    });
    const res = await GET(makeReq("bad"));
    expect(res.status).toBe(404);
  });

  it("includes Cache-Control: public, max-age=30", async () => {
    setupMocks({
      activation: { address: "alice", fid: null, activated_at: "2026-07-01", is_blacklisted: false },
      eligible: [{ address: "alice", fid: null }],
      buys: [],
    });
    const res = await GET(makeReq("alice"));
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=30");
  });

  it("returns 400 when address is missing", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });
});
