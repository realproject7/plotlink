// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ error: null }) });
const mockSelectSingle = vi.fn();

vi.mock("../../../../../lib/airdrop/siwe-verify", () => ({
  verifySiweRequest: vi.fn(),
}));
vi.mock("../../../../../lib/supabase", () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: mockSelectSingle }) }),
      update: (data: unknown) => {
        mockUpdate(data);
        return { eq: vi.fn().mockReturnValue({ error: null }) };
      },
    }),
  }),
}));

import { POST } from "./route";
import { verifySiweRequest } from "../../../../../lib/airdrop/siwe-verify";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/airdrop/x-follow-click", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => { vi.clearAllMocks(); });

describe("POST /api/airdrop/x-follow-click", () => {
  it("returns 401 on invalid signature", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: false, error: "expired" });
    const res = await POST(makeReq({ message: "m", signature: "s" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 if no activation row exists", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: true, address: "0xabc" });
    mockSelectSingle.mockResolvedValue({ data: null });
    const res = await POST(makeReq({ message: "m", signature: "s" }));
    expect(res.status).toBe(400);
  });

  it("sets activated_at when handle confirmed + follow click completes activation", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: true, address: "0xabc" });
    mockSelectSingle.mockResolvedValue({
      data: { x_handle_confirmed_at: "2026-07-01", x_follow_at: null, activated_at: null },
    });

    const res = await POST(makeReq({ message: "m", signature: "s" }));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ activated_at: expect.any(String) }),
    );
    const data = await res.json();
    expect(data.activated).toBe(true);
  });

  it("does not re-set activated_at if already activated", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: true, address: "0xabc" });
    mockSelectSingle.mockResolvedValue({
      data: { x_handle_confirmed_at: "2026-07-01", x_follow_at: "2026-07-01", activated_at: "2026-07-01" },
    });

    const res = await POST(makeReq({ message: "m", signature: "s" }));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.not.objectContaining({ activated_at: expect.anything() }),
    );
  });
});
