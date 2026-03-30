"use server";

/**
 * Server action proxy for real-time indexer endpoints.
 * Injects the server-only INDEX_SECRET so the client never sees it.
 */

const INDEX_SECRET = process.env.INDEX_SECRET;

export async function indexFetch(
  route: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number }> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || "http://localhost:3000";

  const res = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(INDEX_SECRET ? { "x-index-key": INDEX_SECRET } : {}),
    },
    body: JSON.stringify(body),
  });

  return { ok: res.ok, status: res.status };
}
