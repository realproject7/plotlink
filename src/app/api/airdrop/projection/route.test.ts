// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const mockRpc = vi.fn();
const mockActivationSingle = vi.fn();

vi.mock("../../../../../lib/supabase", () => ({
  createServerClient: () => ({
    rpc: mockRpc,
    from: (table: string) => {
      if (table === "pl_activations") {
        return { select: () => ({ eq: () => ({ single: mockActivationSingle }) }) };
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

describe("GET /api/airdrop/projection", () => {
  it("§4 worked example: 100 PLOT + 2 refs + FC → 1.6x, weighted 160", async () => {
    const ref1Ws = 60;
    const ref2Ws = 80;
    const aliceWs = 160;
    const total = aliceWs + ref1Ws + ref2Ws;

    mockRpc.mockResolvedValue({
      data: [
        { address: "alice", buy_volume: 100, qualified_refs: 2, has_fc_bonus: 1, multiplier: 1.6, weighted_spend: 160, community_total: total },
        { address: "ref1", buy_volume: 60, qualified_refs: 0, has_fc_bonus: 0, multiplier: 1, weighted_spend: 60, community_total: total },
        { address: "ref2", buy_volume: 80, qualified_refs: 0, has_fc_bonus: 0, multiplier: 1, weighted_spend: 80, community_total: total },
      ],
      error: null,
    });

    const res = await GET(makeReq("alice"));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.buy_volume).toBe(100);
    expect(data.qualified_refs).toBe(2);
    expect(data.has_fc_bonus).toBe(true);
    expect(data.multiplier).toBeCloseTo(1.6);
    expect(data.weighted_spend).toBeCloseTo(160);
    expect(data.community_total).toBeCloseTo(total);

    const share = 160 / total;
    expect(data.projected_share.bronze).toBeCloseTo(200_000 * 0.10 * share);
    expect(data.projected_share.silver).toBeCloseTo(200_000 * 0.30 * share);
    expect(data.projected_share.gold).toBeCloseTo(200_000 * 0.50 * share);
    expect(data.projected_share.diamond).toBeCloseTo(200_000 * 1.00 * share);
  });

  it("returns zeros for activated wallet with no buys", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockActivationSingle.mockResolvedValue({ data: { activated_at: "2026-07-01", is_blacklisted: false } });

    const res = await GET(makeReq("alice"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.buy_volume).toBe(0);
    expect(data.weighted_spend).toBe(0);
    expect(data.projected_share.diamond).toBe(0);
  });

  it("returns 404 for non-activated wallet", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockActivationSingle.mockResolvedValue({ data: null });

    const res = await GET(makeReq("0xnone"));
    expect(res.status).toBe(404);
  });

  it("returns 404 for blacklisted wallet", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockActivationSingle.mockResolvedValue({ data: { activated_at: "2026-07-01", is_blacklisted: true } });

    const res = await GET(makeReq("bad"));
    expect(res.status).toBe(404);
  });

  it("includes Cache-Control: public, max-age=30", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockActivationSingle.mockResolvedValue({ data: { activated_at: "2026-07-01", is_blacklisted: false } });

    const res = await GET(makeReq("alice"));
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=30");
  });

  it("returns 400 when address is missing", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });

  it("returns 500 when RPC fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "function not found" } });

    const res = await GET(makeReq("alice"));
    expect(res.status).toBe(500);
  });
});
