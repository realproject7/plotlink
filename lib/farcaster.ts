/**
 * Farcaster identity lookup via Neynar API.
 *
 * Resolves an Ethereum address to a Farcaster username + avatar.
 * Results are cached in memory to avoid redundant API calls.
 */

export interface FarcasterProfile {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string | null;
}

const NEYNAR_BASE = "https://api.neynar.com/v2/farcaster";

const CACHE_TTL_MS = 3600_000; // 1 hour for successful lookups
const cache = new Map<string, { profile: FarcasterProfile; expiresAt: number }>();

function getApiKey(): string | undefined {
  return process.env.NEYNAR_API_KEY;
}

/**
 * Look up a Farcaster profile by Ethereum address.
 * Returns `null` when no Farcaster account is linked or the API is unavailable.
 * Only caches successful lookups with TTL; transient errors are never cached.
 */
export async function lookupByAddress(
  address: string,
): Promise<FarcasterProfile | null> {
  const key = address.toLowerCase();

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.profile;
  if (cached) cache.delete(key);

  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `${NEYNAR_BASE}/user/bulk-by-address?addresses=${key}`,
      {
        headers: { accept: "application/json", "x-api-key": apiKey },
        next: { revalidate: 3600 },
      },
    );

    if (!res.ok) return null;

    const json = await res.json();
    const users = json[key];

    if (!Array.isArray(users) || users.length === 0) return null;

    const user = users[0];
    const profile: FarcasterProfile = {
      fid: user.fid,
      username: user.username,
      displayName: user.display_name ?? user.username,
      pfpUrl: user.pfp_url ?? null,
    };

    cache.set(key, { profile, expiresAt: Date.now() + CACHE_TTL_MS });
    return profile;
  } catch {
    return null;
  }
}
