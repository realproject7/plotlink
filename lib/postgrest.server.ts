import { PostgrestClient } from "@supabase/postgrest-js";
import type { Database } from "./supabase";

export type DatabaseClient = PostgrestClient<Database>;
type Access = "admin" | "public";
interface Options {
  environment?: Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
}

/** Private JWTs stay on the server. A selected native endpoint fails closed. */
export function databaseConnection(
  access: Access,
  environment: Record<string, string | undefined> = process.env,
): { url: string; headers: Record<string, string> } | null {
  if (typeof window !== "undefined") {
    throw new Error("Database connections must only be created on the server");
  }
  const endpoint = environment.POSTGREST_URL?.trim();
  if (endpoint) {
    const name = access === "admin" ? "POSTGREST_ADMIN_JWT" : "POSTGREST_PUBLIC_JWT";
    const token = environment[name]?.trim();
    if (!token) throw new Error(`${name} is not set`);
    return { url: endpoint.replace(/\/+$/, ""), headers: { Authorization: `Bearer ${token}` } };
  }
  const url = environment.NEXT_PUBLIC_SUPABASE_URL;
  const key = access === "admin"
    ? environment.SUPABASE_SERVICE_ROLE_KEY
    : environment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return {
    url: `${url.replace(/\/+$/, "")}/rest/v1`,
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  };
}

export function createDatabaseClient(access: Access = "admin", options: Options = {}): DatabaseClient | null {
  const connection = databaseConnection(access, options.environment);
  return connection ? new PostgrestClient<Database>(connection.url, {
    headers: connection.headers, schema: "public", fetch: options.fetch,
  }) : null;
}
