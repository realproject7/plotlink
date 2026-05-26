// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockRpc = vi.fn();
const mockUsers = vi.fn();

vi.mock("../../../../../lib/supabase", () => ({
  createServerClient: () => ({
    rpc: mockRpc,
    from: (table: string) => {
      if (table === "pl_referral_codes") return { select: () => ({ in: mockUsers }) };
      return {};
    },
  }),
}));
vi.mock("../../../../../lib/airdrop/config", () => ({
  getAirdropConfig: () => ({
    CAMPAIGN_START: new Date("2026-07-01"),
    CAMPAIGN_END: new Date("2026-10-01"),
    MIN_REFERRAL_THRESHOLD: 50,
    REFERRAL_MULTIPLIER_PER_REF: 0.2,
    REFERRAL_MULTIPLIER_CAP: 3.0,
  }),
}));

import { GET } from "./route";

describe("GET /api/airdrop/leaderboard", () => {
  it("returns entries ordered by weighted_spend DESC", async () => {
    mockRpc.mockResolvedValue({
      data: [
        { address: "alice", weighted_spend: 200, buy_volume: 100, qualified_refs: 1, has_fc_bonus: 1, multiplier: 2, community_total: 500 },
        { address: "bob", weighted_spend: 300, buy_volume: 150, qualified_refs: 2, has_fc_bonus: 0, multiplier: 1.4, community_total: 500 },
      ],
      error: null,
    });
    mockUsers.mockResolvedValue({ data: [] });

    const req = new NextRequest("http://localhost/api/airdrop/leaderboard");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entries[0].address).toBe("bob");
    expect(data.entries[1].address).toBe("alice");
    expect(data.entries[0].totalPoints).toBe(300);
  });

  it("returns empty when no eligible wallets", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockUsers.mockResolvedValue({ data: [] });

    const req = new NextRequest("http://localhost/api/airdrop/leaderboard");
    const res = await GET(req);
    const data = await res.json();
    expect(data.entries).toHaveLength(0);
    expect(data.totalParticipants).toBe(0);
  });

  it("passes correct config params to weighted_spend RPC", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockUsers.mockResolvedValue({ data: [] });

    const req = new NextRequest("http://localhost/api/airdrop/leaderboard");
    await GET(req);
    expect(mockRpc).toHaveBeenCalledWith("weighted_spend", expect.objectContaining({
      p_campaign_start: expect.any(String),
      p_campaign_end: expect.any(String),
      p_min_referral_threshold: 50,
      p_multiplier_per_ref: 0.2,
      p_multiplier_cap: 3.0,
    }));
  });
});
