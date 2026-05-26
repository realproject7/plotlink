// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockUpdate = vi.fn();
let updateResult: { data: unknown; error: unknown } = { data: { address: "0xabc" }, error: null };

vi.mock("../../../../../lib/airdrop/siwe-verify", () => ({
  verifySiweRequest: vi.fn(),
}));
vi.mock("../../../../../lib/airdrop/activation-verify", () => ({
  verifyFc: vi.fn(),
}));
vi.mock("../../../../../lib/airdrop/config", () => ({
  getAirdropConfig: () => ({ PLOTLINK_FC_FID: 12345 }),
}));
vi.mock("../../../../../lib/supabase", () => ({
  createServerClient: () => ({
    from: () => ({
      update: (data: unknown) => {
        mockUpdate(data);
        return {
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve(updateResult),
            }),
          }),
        };
      },
    }),
  }),
}));

import { POST } from "./route";
import { verifySiweRequest } from "../../../../../lib/airdrop/siwe-verify";
import { verifyFc } from "../../../../../lib/airdrop/activation-verify";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/airdrop/verify-fc", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  updateResult = { data: { address: "0xabc" }, error: null };
});

describe("POST /api/airdrop/verify-fc", () => {
  it("returns 401 on invalid SIWE signature", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: false, error: "expired" });
    const res = await POST(makeReq({ message: "m", signature: "s", username: "u" }));
    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 for user_not_found — no DB write", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: true, address: "0xabc" });
    vi.mocked(verifyFc).mockResolvedValue({ ok: false, error: "user_not_found" });
    const res = await POST(makeReq({ message: "m", signature: "s", username: "ghost" }));
    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 422 for not_following — no DB write", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: true, address: "0xabc" });
    vi.mocked(verifyFc).mockResolvedValue({ ok: false, error: "not_following" });
    const res = await POST(makeReq({ message: "m", signature: "s", username: "nofol" }));
    expect(res.status).toBe(422);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 502 for neynar_error — no DB write", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: true, address: "0xabc" });
    vi.mocked(verifyFc).mockResolvedValue({ ok: false, error: "neynar_error" });
    const res = await POST(makeReq({ message: "m", signature: "s", username: "err" }));
    expect(res.status).toBe(502);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("persists fid + fc_handle + fc_verified_at on success", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: true, address: "0xabc" });
    vi.mocked(verifyFc).mockResolvedValue({ ok: true, fid: 999 });
    const res = await POST(makeReq({ message: "m", signature: "s", username: "TestUser" }));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ fid: 999, fc_handle: "testuser", fc_verified_at: expect.any(String) }),
    );
  });

  it("returns 409 on FID UNIQUE conflict", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: true, address: "0xabc" });
    vi.mocked(verifyFc).mockResolvedValue({ ok: true, fid: 999 });
    updateResult = { data: null, error: { code: "23505", message: "unique violation" } };
    const res = await POST(makeReq({ message: "m", signature: "s", username: "dupe" }));
    expect(res.status).toBe(409);
  });

  it("returns 400 when no activation row exists", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: true, address: "0xnew" });
    vi.mocked(verifyFc).mockResolvedValue({ ok: true, fid: 888 });
    updateResult = { data: null, error: { code: "PGRST116", message: "no rows" } };
    const res = await POST(makeReq({ message: "m", signature: "s", username: "newuser" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Must confirm X handle first");
  });
});
