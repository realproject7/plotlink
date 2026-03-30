/**
 * Fetch wrapper for real-time indexer endpoints.
 * Automatically includes the x-index-key header.
 *
 * NEXT_PUBLIC_INDEX_KEY is a speed bump against casual bot spam,
 * not a secret — it is embedded in the client bundle by design.
 */

const INDEX_KEY = process.env.NEXT_PUBLIC_INDEX_KEY;

export function indexFetch(route: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(route, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(INDEX_KEY ? { "x-index-key": INDEX_KEY } : {}),
    },
    body: JSON.stringify(body),
  });
}
