import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  vi.stubEnv("NEYNAR_API_KEY", "test-neynar-key");
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function mockFetch(status: number, body?: unknown) {
  return vi.mocked(fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: () => Promise.resolve(body),
  } as Response);
}

const PLOTLINK_FID = 12345;

describe("verifyFc", () => {
  it("returns ok with fid when user exists and follows plotlink", async () => {
    const { verifyFc } = await import("./activation-verify");

    mockFetch(200, { user: { fid: 999 } });
    mockFetch(200, {
      users: [{ fid: PLOTLINK_FID, viewer_context: { following: true } }],
    });

    const result = await verifyFc("testuser", PLOTLINK_FID);
    expect(result).toEqual({ ok: true, fid: 999 });
  });

  it("returns user_not_found when username returns 404", async () => {
    const { verifyFc } = await import("./activation-verify");
    mockFetch(404);

    const result = await verifyFc("nonexistent", PLOTLINK_FID);
    expect(result).toEqual({ ok: false, error: "user_not_found" });
  });

  it("returns user_not_found when username returns 400", async () => {
    const { verifyFc } = await import("./activation-verify");
    mockFetch(400);

    const result = await verifyFc("bad!", PLOTLINK_FID);
    expect(result).toEqual({ ok: false, error: "user_not_found" });
  });

  it("returns user_not_found when response has no fid", async () => {
    const { verifyFc } = await import("./activation-verify");
    mockFetch(200, { user: {} });

    const result = await verifyFc("nofid", PLOTLINK_FID);
    expect(result).toEqual({ ok: false, error: "user_not_found" });
  });

  it("returns not_following when user exists but doesn't follow", async () => {
    const { verifyFc } = await import("./activation-verify");

    mockFetch(200, { user: { fid: 999 } });
    mockFetch(200, {
      users: [{ fid: PLOTLINK_FID, viewer_context: { following: false } }],
    });

    const result = await verifyFc("testuser", PLOTLINK_FID);
    expect(result).toEqual({ ok: false, error: "not_following" });
  });

  it("returns neynar_error on 5xx from username lookup", async () => {
    const { verifyFc } = await import("./activation-verify");
    mockFetch(500);

    const result = await verifyFc("testuser", PLOTLINK_FID);
    expect(result).toEqual({ ok: false, error: "neynar_error" });
  });

  it("returns neynar_error on 5xx from follow check", async () => {
    const { verifyFc } = await import("./activation-verify");
    mockFetch(200, { user: { fid: 999 } });
    mockFetch(500);

    const result = await verifyFc("testuser", PLOTLINK_FID);
    expect(result).toEqual({ ok: false, error: "neynar_error" });
  });

  it("returns neynar_error on network failure", async () => {
    const { verifyFc } = await import("./activation-verify");
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network error"));

    const result = await verifyFc("testuser", PLOTLINK_FID);
    expect(result).toEqual({ ok: false, error: "neynar_error" });
  });

  it("returns neynar_error when NEYNAR_API_KEY is not set", async () => {
    vi.stubEnv("NEYNAR_API_KEY", "");
    const { verifyFc } = await import("./activation-verify");

    const result = await verifyFc("testuser", PLOTLINK_FID);
    expect(result).toEqual({ ok: false, error: "neynar_error" });
  });
});
