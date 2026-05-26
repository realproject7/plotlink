// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../../lib/airdrop/siwe-verify", () => ({
  verifySiweRequest: vi.fn(),
}));
vi.mock("../../../../../lib/airdrop/twitterapi", () => ({
  lookupXUser: vi.fn(),
}));

import { POST } from "./route";
import { verifySiweRequest } from "../../../../../lib/airdrop/siwe-verify";
import { lookupXUser } from "../../../../../lib/airdrop/twitterapi";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/airdrop/verify-x-handle", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => { vi.clearAllMocks(); });

describe("POST /api/airdrop/verify-x-handle", () => {
  it("returns 401 on invalid signature", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: false, error: "expired" });
    const res = await POST(makeReq({ message: "m", signature: "s", username: "u" }));
    expect(res.status).toBe(401);
  });

  it("returns lookup data without persisting", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: true, address: "0xabc" });
    vi.mocked(lookupXUser).mockResolvedValue({
      display_name: "Test", avatar_url: "url", follower_count: 100, x_user_id: "123", bio_snippet: "bio",
    });
    const res = await POST(makeReq({ message: "m", signature: "s", username: "testuser" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.display_name).toBe("Test");
    expect(data.x_user_id).toBe("123");
  });

  it("returns 404 when user not found", async () => {
    vi.mocked(verifySiweRequest).mockResolvedValue({ ok: true, address: "0xabc" });
    vi.mocked(lookupXUser).mockResolvedValue(null);
    const res = await POST(makeReq({ message: "m", signature: "s", username: "ghost" }));
    expect(res.status).toBe(404);
  });
});
