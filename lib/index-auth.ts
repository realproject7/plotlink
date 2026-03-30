/**
 * Shared auth check for real-time indexer endpoints.
 *
 * Uses NEXT_PUBLIC_INDEX_KEY as a shared key. The client sends this
 * via the x-index-key header. This is a speed bump against casual bot
 * spam, not real auth — the key is embedded in the client bundle by design.
 * True protection comes from on-chain event verification in each indexer.
 *
 * Fails closed in production when NEXT_PUBLIC_INDEX_KEY is unset.
 */

const INDEX_KEY = process.env.NEXT_PUBLIC_INDEX_KEY;

export function verifyIndexAuth(req: Request): boolean {
  if (!INDEX_KEY) {
    // Allow in dev, fail closed in production
    return process.env.NODE_ENV !== "production";
  }
  const key = req.headers.get("x-index-key");
  return key === INDEX_KEY;
}
