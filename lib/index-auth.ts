/**
 * Shared auth check for real-time indexer endpoints.
 *
 * Uses server-only INDEX_SECRET. The client never sees this value —
 * frontend calls go through a server action proxy that injects it.
 *
 * Fails closed in production when INDEX_SECRET is unset.
 */

const INDEX_SECRET = process.env.INDEX_SECRET;

export function verifyIndexAuth(req: Request): boolean {
  if (!INDEX_SECRET) {
    // Allow in dev, fail closed in production
    return process.env.NODE_ENV !== "production";
  }
  const key = req.headers.get("x-index-key");
  return key === INDEX_SECRET;
}
