/**
 * Farcaster identity lookup — Steemhunt primary, Neynar fallback.
 *
 * Steemhunt's Farcaster Indexer (https://fc.hunt.town) is free and requires
 * no API key. Neynar is used as a fallback only when NEYNAR_API_KEY is set.
 *
 * Simple in-memory cache with 1h TTL, 3s request timeout.
 */

export interface FarcasterProfile {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string | null;
}

const STEEMHUNT_BASE = "https://fc.hunt.town";
const NEYNAR_BASE = "https://api.neynar.com/v2/farcaster";
const REQUEST_TIMEOUT_MS = 3000;
const CACHE_TTL_MS = 3600_000; // 1 hour

const cache = new Map<string, { profile: FarcasterProfile | null; expiresAt: number }>();
const inFlight = new Map<string, Promise<FarcasterProfile | null>>();

/**
 * Try Steemhunt first, then Neynar if configured. Returns null if both fail.
 */
async function steemhuntLookup(address: string): Promise<FarcasterProfile | null> {
  const res = await fetch(`${STEEMHUNT_BASE}/users/byWallet/${address}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || !data.fid) return null;
  return {
    fid: data.fid,
    username: data.username,
    displayName: data.displayName ?? data.username,
    pfpUrl: data.pfpUrl ?? null,
  };
}

async function neynarLookup(address: string): Promise<FarcasterProfile | null> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(
    `${NEYNAR_BASE}/user/bulk-by-address?addresses=${address}`,
    {
      headers: { accept: "application/json", "x-api-key": apiKey },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (!res.ok) return null;
  const json = await res.json();
  const users = json[address];
  if (!Array.isArray(users) || users.length === 0) return null;
  const user = users[0];
  return {
    fid: user.fid,
    username: user.username,
    displayName: user.display_name ?? user.username,
    pfpUrl: user.pfp_url ?? null,
  };
}

/**
 * Look up a Farcaster profile by Ethereum address.
 * Returns `null` when no Farcaster account is linked or both APIs are unavailable.
 */
export async function lookupByAddress(
  address: string,
): Promise<FarcasterProfile | null> {
  const key = address.toLowerCase();

  // Check cache
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.profile;
  if (cached) cache.delete(key);

  // Deduplicate in-flight requests
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      // Steemhunt first (free, no key needed)
      const profile = await steemhuntLookup(key).catch(() => null);
      if (profile) {
        cache.set(key, { profile, expiresAt: Date.now() + CACHE_TTL_MS });
        return profile;
      }

      // Neynar fallback
      const fallback = await neynarLookup(key).catch(() => null);
      cache.set(key, { profile: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
      return fallback;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}
