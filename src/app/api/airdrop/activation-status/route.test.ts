// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const mockSingle = vi.fn();

vi.mock("../../../../../lib/supabase", () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: mockSingle }) }),
    }),
  }),
}));

import { GET } from "./route";

function makeReq(address?: string) {
  const url = address
    ? `http://localhost/api/airdrop/activation-status?address=${address}`
    : "http://localhost/api/airdrop/activation-status";
  return new Request(url);
}

describe("GET /api/airdrop/activation-status", () => {
  it("returns 4 fields for activated wallet", async () => {
    mockSingle.mockResolvedValue({
      data: {
        x_handle_confirmed_at: "2026-07-01",
        x_follow_at: "2026-07-02",
        fc_verified_at: "2026-07-03",
        activated_at: "2026-07-02",
      },
    });
    const res = await GET(makeReq("0xabc"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.x_handle_confirmed_at).toBe("2026-07-01");
    expect(data.activated_at).toBe("2026-07-02");
  });

  it("returns all-null for non-existent address", async () => {
    mockSingle.mockResolvedValue({ data: null });
    const res = await GET(makeReq("0xnonexistent"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      x_handle_confirmed_at: null,
      x_follow_at: null,
      fc_verified_at: null,
      activated_at: null,
    });
  });

  it("includes Cache-Control: no-store header", async () => {
    mockSingle.mockResolvedValue({ data: null });
    const res = await GET(makeReq("0xabc"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 400 when address is missing", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });
});
