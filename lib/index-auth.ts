/**
 * Shared auth check for real-time indexer endpoints.
 * Uses NEXT_PUBLIC_INDEX_TOKEN as a lightweight API key.
 * Fails closed in production when the token is unset.
 */

const INDEX_TOKEN = process.env.NEXT_PUBLIC_INDEX_TOKEN;

export function verifyIndexAuth(req: Request): boolean {
  if (!INDEX_TOKEN) {
    // Allow in dev, fail closed in production
    return process.env.NODE_ENV !== "production";
  }
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${INDEX_TOKEN}`;
}
