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

const cache = new Map<string, FarcasterProfile | null>();

function getApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_NEYNAR_API_KEY;
}

/**
 * Look up a Farcaster profile by Ethereum address.
 * Returns `null` when no Farcaster account is linked or the API is unavailable.
 */
export async function lookupByAddress(
  address: string,
): Promise<FarcasterProfile | null> {
  const key = address.toLowerCase();

  if (cache.has(key)) return cache.get(key)!;

  const apiKey = getApiKey();
  if (!apiKey) {
    cache.set(key, null);
    return null;
  }

  try {
    const res = await fetch(
      `${NEYNAR_BASE}/user/bulk-by-address?addresses=${key}`,
      {
        headers: { accept: "application/json", "x-api-key": apiKey },
        next: { revalidate: 3600 }, // cache for 1 hour in Next.js fetch cache
      },
    );

    if (!res.ok) {
      cache.set(key, null);
      return null;
    }

    const json = await res.json();
    const users = json[key];

    if (!Array.isArray(users) || users.length === 0) {
      cache.set(key, null);
      return null;
    }

    const user = users[0];
    const profile: FarcasterProfile = {
      fid: user.fid,
      username: user.username,
      displayName: user.display_name ?? user.username,
      pfpUrl: user.pfp_url ?? null,
    };

    cache.set(key, profile);
    return profile;
  } catch {
    cache.set(key, null);
    return null;
  }
}
