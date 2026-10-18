import { databaseConnection } from "./postgrest.server";

// These are the public tables already read by the browser. Native read roles
// must retain their source SELECT policies, including visibility restrictions.
export const PUBLIC_READ_TABLES = new Set([
  "storylines", "plots", "donations", "ratings", "trade_history",
]);

export async function publicDataResponse(
  request: Request,
  table: string,
  options: {
    environment?: Record<string, string | undefined>;
    fetch?: typeof globalThis.fetch;
  } = {},
): Promise<Response> {
  if (!["GET", "HEAD"].includes(request.method)) {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  if (!PUBLIC_READ_TABLES.has(table)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const connection = databaseConnection("public", options.environment);
  if (!connection) return Response.json({ error: "Database unavailable" }, { status: 503 });
  const incoming = new URL(request.url);
  const target = new URL(`${connection.url}/${table}`);
  target.search = incoming.search;
  const headers = new Headers(connection.headers);
  // Never forward caller auth, cookies or profile headers to the private DB.
  headers.set("Accept-Profile", "public");
  const accept = request.headers.get("accept");
  if (accept === "application/vnd.pgrst.object+json") headers.set("accept", accept);
  else headers.set("accept", "application/json");
  for (const name of ["range", "range-unit"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const count = request.headers.get("prefer")?.match(/(?:^|,)\s*count=(exact|planned|estimated)(?:,|$)/);
  if (count) headers.set("prefer", `count=${count[1]}`);
  try {
    const response = await (options.fetch ?? fetch)(target, {
      method: request.method, headers, cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    const outgoing = new Headers({ "Cache-Control": "no-store" });
    for (const name of ["content-type", "content-range", "range-unit"]) {
      const value = response.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    return new Response(request.method === "HEAD" ? null : response.body, {
      status: response.status, headers: outgoing,
    });
  } catch {
    return Response.json({ error: "Database unavailable" }, { status: 502 });
  }
}
