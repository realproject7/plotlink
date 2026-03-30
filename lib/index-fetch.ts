"use server";

import { headers } from "next/headers";

/**
 * Server action proxy for real-time indexer endpoints.
 *
 * Security layers:
 * 1. Route whitelist — only the 4 known indexer paths, prevents SSRF
 * 2. Origin validation — rejects calls not originating from our own site
 * 3. Server-only INDEX_SECRET — injected into the internal fetch
 */

const INDEX_SECRET = process.env.INDEX_SECRET;

const ALLOWED_ROUTES = new Set([
  "/api/index/trade",
  "/api/index/storyline",
  "/api/index/plot",
  "/api/index/donation",
]);

export async function indexFetch(
  route: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number }> {
  // Whitelist check — prevent SSRF
  if (!ALLOWED_ROUTES.has(route)) {
    return { ok: false, status: 400 };
  }

  // Origin validation — reject calls not from our own site
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || "http://localhost:3000";

  if (origin && !siteUrl.startsWith(origin)) {
    return { ok: false, status: 403 };
  }

  const res = await fetch(`${siteUrl}${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(INDEX_SECRET ? { "x-index-key": INDEX_SECRET } : {}),
    },
    body: JSON.stringify(body),
  });

  return { ok: res.ok, status: res.status };
}
