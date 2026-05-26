// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockUpsert = vi.fn().mockReturnValue({ error: null });
const mockInsert = vi.fn().mockReturnValue({ error: null });
const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null }) }) }),
});

vi.mock("../../../../../lib/airdrop/siwe-verify", () => ({
  verifySiweRequest: vi.fn(),
}));
vi.mock("../../../../../lib/airdrop/twitterapi", () => ({
  lookupXUser: vi.fn(),
}));
vi.mock("../../../../../lib/supabase", () => ({
  createServerClient: () => ({
    from: (table: string) => {
      if (table === "pl_activations") return { upsert: mockUpsert };
      if (table === "pl_referral_codes") return { select: mockSelect, insert: mockInsert };
      return {};
    },
  }),
}));
vi.mock("nanoid", () => ({ nanoid: () => "test1234" }));

import { POST } from "./route";
import { verifySiweRequest } from "../../../../../lib/airdrop/siwe-verify";
import { lookupXUser } from "../../../../../lib/airdrop/twitterapi";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/airdrop/confirm-x-handle", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => { vi.clearAllMocks(); mockUpsert.mockReturnValue({ error: null }); });

describe("POST /api/airdrop/confirm-x-handle", () => {
  it("returns 401 on invalid signature", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: false, error: "invalid_signature" });
    const res = await POST(makeReq({ message: "m", signature: "s", username: "u" }));
    expect(res.status).toBe(401);
  });

  it("server re-lookups username (ignores client x_user_id)", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: true, address: "0xabc" });
    vi.mocked(lookupXUser).mockResolvedValue({
      display_name: "Real", avatar_url: "url", follower_count: 50, x_user_id: "server_id", bio_snippet: "bio",
    });

    const res = await POST(makeReq({ message: "m", signature: "s", username: "test", x_user_id: "bogus_id" }));
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ x_user_id: "server_id" }),
      expect.anything(),
    );
  });

  it("returns 404 for nonexistent X user", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: true, address: "0xabc" });
    vi.mocked(lookupXUser).mockResolvedValue(null);

    const res = await POST(makeReq({ message: "m", signature: "s", username: "ghost" }));
    expect(res.status).toBe(404);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("returns 409 on UNIQUE conflict", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: true, address: "0xabc" });
    vi.mocked(lookupXUser).mockResolvedValue({
      display_name: "Test", avatar_url: "url", follower_count: 50, x_user_id: "123", bio_snippet: "bio",
    });
    mockUpsert.mockReturnValue({ error: { code: "23505", message: "unique violation" } });

    const res = await POST(makeReq({ message: "m", signature: "s", username: "taken" }));
    expect(res.status).toBe(409);
  });

  it("R16: writes pending row when twitterapi.io throws", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: true, address: "0xabc" });
    vi.mocked(lookupXUser).mockRejectedValue(new Error("network error"));

    const res = await POST(makeReq({ message: "m", signature: "s", username: "downuser" }));
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ x_handle_confirmed_at: null, x_user_id: null }),
      expect.anything(),
    );
    const data = await res.json();
    expect(data.confirmed).toBe(false);
  });
});
