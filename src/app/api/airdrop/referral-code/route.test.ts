// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockInsert = vi.fn().mockReturnValue({ error: null });
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
      if (table === "pl_referral_codes") {
        return {
          select: () => ({ eq: () => ({ single: mockSelectCode }) }),
          insert: mockInsert,
        };
      }
      return {};
    },
  }),
}));
vi.mock("nanoid", () => ({ nanoid: () => "testcode" }));

import { GET, POST } from "./route";
import { verifySiweRequest } from "../../../../../lib/airdrop/siwe-verify";

function makePostReq(body: unknown) {
  return new Request("http://localhost/api/airdrop/referral-code", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockReturnValue({ error: null });
});

describe("POST /api/airdrop/referral-code", () => {
  it("returns 401 on expired SIWE signature", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: false, error: "expired" });
    const res = await POST(makePostReq({ message: "m", signature: "s" }));
    expect(res.status).toBe(401);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 401 on wrong chainId", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: false, error: "chain_id_mismatch" });
    const res = await POST(makePostReq({ message: "m", signature: "s" }));
    expect(res.status).toBe(401);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("succeeds with valid SIWE and generates code", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: true, address: "0xabc" });
    mockSelectCode.mockResolvedValue({ data: null });

    const res = await POST(makePostReq({ message: "m", signature: "s" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.code).toBe("testcode");
  });
});

describe("GET /api/airdrop/referral-code", () => {
  it("remains unauthenticated — returns code without auth headers", async () => {
    mockSelectCode.mockResolvedValue({ data: { code: "mycode", is_farcaster_username: false } });
    const url = new URL("http://localhost/api/airdrop/referral-code?address=0xabc");
    const req = Object.assign(new Request(url), { nextUrl: url });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.code).toBe("mycode");
    expect(data).toHaveProperty("is_farcaster_username");
  });

  it("returns { code: null } for unknown address", async () => {
    mockSelectCode.mockResolvedValue({ data: null });
    const url = new URL("http://localhost/api/airdrop/referral-code?address=0xnone");
    const req = Object.assign(new Request(url), { nextUrl: url });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.code).toBeNull();
  });
});
