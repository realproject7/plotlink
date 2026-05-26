import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  vi.stubEnv("TWITTERAPI_IO_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(async () => {
  const { _clearCache } = await import("./twitterapi");
  _clearCache();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function mockFetchResponse(status: number, body?: unknown) {
  return vi.mocked(fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? "Not Found" : status >= 500 ? "Internal Server Error" : "OK",
    json: () => Promise.resolve(body),
  } as Response);
}

const MOCK_USER_DATA = {
  data: {
    id: "12345",
    name: "Test User",
    profile_image_url: "https://pbs.twimg.com/photo.jpg",
    public_metrics: { followers_count: 1500 },
    description: "Hello world bio",
  },
};

describe("lookupXUser", () => {
  it("returns user data for a successful lookup", async () => {
    const { lookupXUser } = await import("./twitterapi");
    mockFetchResponse(200, MOCK_USER_DATA);

    const result = await lookupXUser("testuser");
    expect(result).toEqual({
      display_name: "Test User",
      avatar_url: "https://pbs.twimg.com/photo.jpg",
      follower_count: 1500,
      x_user_id: "12345",
      bio_snippet: "Hello world bio",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.twitterapi.io/v2/users/by/username/testuser",
      { headers: { "X-API-Key": "test-key" } },
    );
  });

  it("returns null for 404", async () => {
    const { lookupXUser } = await import("./twitterapi");
    mockFetchResponse(404);

    const result = await lookupXUser("nonexistent");
    expect(result).toBeNull();
  });

  it("throws on 5xx", async () => {
    const { lookupXUser } = await import("./twitterapi");
    mockFetchResponse(500);

    await expect(lookupXUser("testuser")).rejects.toThrow("twitterapi.io error: 500");
  });

  it("uses cache on second call within TTL", async () => {
    const { lookupXUser } = await import("./twitterapi");
    mockFetchResponse(200, MOCK_USER_DATA);

    const first = await lookupXUser("cached_user");
    const second = await lookupXUser("cached_user");

    expect(first).toEqual(second);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("caches null results (404)", async () => {
    const { lookupXUser } = await import("./twitterapi");
    mockFetchResponse(404);

    await lookupXUser("missing");
    await lookupXUser("missing");

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("normalizes username to lowercase for cache key", async () => {
    const { lookupXUser } = await import("./twitterapi");
    mockFetchResponse(200, MOCK_USER_DATA);

    await lookupXUser("TestUser");
    await lookupXUser("testuser");

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("throws when TWITTERAPI_IO_KEY is not set", async () => {
    vi.stubEnv("TWITTERAPI_IO_KEY", "");
    const { lookupXUser } = await import("./twitterapi");

    await expect(lookupXUser("test")).rejects.toThrow("TWITTERAPI_IO_KEY not configured");
  });

  it("truncates bio to 200 chars", async () => {
    const { lookupXUser } = await import("./twitterapi");
    const longBio = "a".repeat(300);
    mockFetchResponse(200, {
      data: { ...MOCK_USER_DATA.data, description: longBio },
    });

    const result = await lookupXUser("longbio");
    expect(result!.bio_snippet).toHaveLength(200);
  });
});
