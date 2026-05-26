// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockInsert = vi.fn().mockReturnValue({ error: null });
const mockSelectReferred = vi.fn();
const mockSelectCode = vi.fn();

vi.mock("../../../../../lib/airdrop/siwe-verify", () => ({
  verifySiweRequest: vi.fn(),
}));
vi.mock("../../../../../lib/rate-limit", () => ({
  checkRateLimit: () => Promise.resolve(true),
  getClientIp: () => "127.0.0.1",
}));
vi.mock("../../../../../lib/supabase", () => ({
  createServerClient: () => ({
    from: (table: string) => {
      if (table === "pl_referrals") {
        return {
          select: () => ({ eq: () => ({ single: mockSelectReferred }) }),
          insert: mockInsert,
        };
      }
      if (table === "pl_referral_codes") {
        return { select: () => ({ eq: () => ({ single: mockSelectCode }) }) };
      }
      return {};
    },
  }),
}));

import { POST } from "./route";
import { verifySiweRequest } from "../../../../../lib/airdrop/siwe-verify";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/airdrop/register-referral", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockReturnValue({ error: null });
});

describe("POST /api/airdrop/register-referral", () => {
  it("returns 401 on expired SIWE signature", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: false, error: "expired" });
    const res = await POST(makeReq({ message: "m", signature: "s", referralCode: "abc" }));
    expect(res.status).toBe(401);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 401 on wrong domain", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: false, error: "domain_mismatch" });
    const res = await POST(makeReq({ message: "m", signature: "s", referralCode: "abc" }));
    expect(res.status).toBe(401);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("succeeds with valid SIWE signature", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: true, address: "0xabc" });
    mockSelectReferred.mockResolvedValue({ data: null });
    mockSelectCode.mockResolvedValue({ data: { address: "0xref" } });

    const res = await POST(makeReq({ message: "m", signature: "s", referralCode: "code1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
