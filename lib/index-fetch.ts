/**
 * Fetch wrapper for real-time indexer endpoints.
 * Automatically includes the INDEX_TOKEN auth header.
 */

const INDEX_TOKEN = process.env.NEXT_PUBLIC_INDEX_TOKEN;

export function indexFetch(route: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(route, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(INDEX_TOKEN ? { Authorization: `Bearer ${INDEX_TOKEN}` } : {}),
    },
    body: JSON.stringify(body),
  });
}
