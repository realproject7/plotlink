const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX = 200;

interface XUser {
  display_name: string;
  avatar_url: string;
  follower_count: number;
  x_user_id: string;
  bio_snippet: string;
}

interface CacheEntry {
  value: XUser | null;
  expiry: number;
}

const cache = new Map<string, CacheEntry>();

function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiry <= now) cache.delete(key);
  }
}

function cacheGet(key: string): { hit: true; value: XUser | null } | { hit: false } {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) {
    cache.delete(key);
    cache.set(key, entry);
    return { hit: true, value: entry.value };
  }
  if (entry) cache.delete(key);
  return { hit: false };
}

function cacheSet(key: string, value: XUser | null) {
  if (cache.size >= CACHE_MAX) evictExpired();
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value!;
    cache.delete(oldest);
  }
  cache.set(key, { value, expiry: Date.now() + CACHE_TTL_MS });
}

export async function lookupXUser(username: string): Promise<XUser | null> {
  const key = username.toLowerCase();

  const cached = cacheGet(key);
  if (cached.hit) return cached.value;

  const apiKey = process.env.TWITTERAPI_IO_KEY;
  if (!apiKey) throw new Error("TWITTERAPI_IO_KEY not configured");

  const res = await fetch(
    `https://api.twitterapi.io/v2/users/by/username/${encodeURIComponent(key)}`,
    { headers: { "X-API-Key": apiKey } },
  );

  if (res.status === 404) {
    cacheSet(key, null);
    return null;
  }

  if (!res.ok) {
    throw new Error(`twitterapi.io error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const user = data?.data;
  if (!user) {
    cacheSet(key, null);
    return null;
  }

  const result: XUser = {
    display_name: user.name ?? "",
    avatar_url: user.profile_image_url ?? "",
    follower_count: user.public_metrics?.followers_count ?? 0,
    x_user_id: String(user.id),
    bio_snippet: (user.description ?? "").slice(0, 200),
  };

  cacheSet(key, result);
  return result;
}

export function _clearCache() {
  cache.clear();
}
