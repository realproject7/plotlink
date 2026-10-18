// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createDatabaseClient, databaseConnection } from "./postgrest.server";
import { publicDataResponse } from "./public-data.server";

let server: Server;
let endpoint: string;
const requests: { url: string; method: string; headers: Record<string, string | string[] | undefined> }[] = [];
beforeAll(async () => {
  server = createServer((request, response) => {
    requests.push({ url: request.url!, method: request.method!, headers: request.headers });
    response.setHeader("content-type", "application/json");
    if (request.url?.includes("missing_column")) {
      response.statusCode = 400;
      response.end(JSON.stringify({ code: "42703", message: "Column does not exist", details: null, hint: null }));
      return;
    }
    response.setHeader("content-range", "0-0/7");
    response.end(JSON.stringify([{ amount: "900719925474099312345678901234567890" }]));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });

describe("private PostgREST transport", () => {
  it("preserves monetary strings and query filters over real HTTP", async () => {
    const client = createDatabaseClient("admin", { environment: { POSTGREST_URL: endpoint, POSTGREST_ADMIN_JWT: "fixture-admin" } })!;
    const result = await client.from("donations").select("amount").eq("storyline_id", 17);
    expect(result.error).toBeNull();
    expect(result.data?.[0].amount).toBe("900719925474099312345678901234567890");
    const last = requests.at(-1)!;
    expect(new URL(last.url, endpoint).searchParams.get("storyline_id")).toBe("eq.17");
    expect(last.headers.authorization).toBe("Bearer fixture-admin");
    expect(last.headers.apikey).toBeUndefined();
  });
  it("retains the existing SQL error shape", async () => {
    const client = createDatabaseClient("admin", { environment: { POSTGREST_URL: endpoint, POSTGREST_ADMIN_JWT: "fixture-admin" } })!;
    const result = await client.from("donations").select("missing_column");
    expect(result.error).toEqual({ code: "42703", message: "Column does not exist", details: null, hint: null });
  });
  it("fails closed without each native role token, even when cloud credentials exist", () => {
    const env = { POSTGREST_URL: endpoint, NEXT_PUBLIC_SUPABASE_URL: "https://cloud.invalid", SUPABASE_SERVICE_ROLE_KEY: "fixture-cloud" };
    expect(() => databaseConnection("admin", env)).toThrow("POSTGREST_ADMIN_JWT");
    expect(() => databaseConnection("public", env)).toThrow("POSTGREST_PUBLIC_JWT");
  });
  it("preserves the cloud transport for the existing deployment", () => {
    expect(databaseConnection("public", { NEXT_PUBLIC_SUPABASE_URL: "https://cloud.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon" }))
      .toEqual({ url: "https://cloud.invalid/rest/v1", headers: { apikey: "fixture-anon", Authorization: "Bearer fixture-anon" } });
  });
});

describe("same-origin public reads", () => {
  const environment = () => ({ POSTGREST_URL: endpoint, POSTGREST_PUBLIC_JWT: "fixture-public", POSTGREST_ADMIN_JWT: "fixture-admin" });
  it("preserves public filters and counts while dropping caller credentials and schema overrides", async () => {
    const response = await publicDataResponse(new Request("https://app.invalid/api/public-data/donations?select=amount&storyline_id=eq.17", {
      headers: { Authorization: "Bearer caller", apikey: "caller", Cookie: "session=caller", "Accept-Profile": "private", Prefer: "tx=commit,count=exact" },
    }), "donations", { environment: environment() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ amount: "900719925474099312345678901234567890" }]);
    expect(response.headers.get("content-range")).toBe("0-0/7");
    const last = requests.at(-1)!;
    expect(last.headers.authorization).toBe("Bearer fixture-public");
    expect(last.headers.apikey).toBeUndefined();
    expect(last.headers.cookie).toBeUndefined();
    expect(last.headers["accept-profile"]).toBe("public");
    expect(last.headers.prefer).toBe("count=exact");
  });
  it("preserves HEAD, ranges and singular-object negotiation", async () => {
    const response = await publicDataResponse(new Request("https://app.invalid/api/public-data/storylines?select=id", {
      method: "HEAD", headers: { Range: "0-19", Accept: "application/vnd.pgrst.object+json" },
    }), "storylines", { environment: environment() });
    expect(response.body).toBeNull();
    expect(response.headers.get("content-range")).toBe("0-0/7");
    const last = requests.at(-1)!;
    expect(last.method).toBe("HEAD");
    expect(last.headers.range).toBe("0-19");
    expect(last.headers.accept).toBe("application/vnd.pgrst.object+json");
  });
  it("rejects private tables, RPCs and writes before reaching the backend", async () => {
    const count = requests.length;
    for (const table of ["users", "notification_tokens", "page_views", "backfill_cursor", "rpc/check_rate_limit", "../storylines"]) {
      const response = await publicDataResponse(new Request("https://app.invalid/api/public-data/" + table), table, { environment: environment() });
      expect(response.status).toBe(404);
    }
    const response = await publicDataResponse(new Request("https://app.invalid/api/public-data/storylines", { method: "POST", body: "{}" }), "storylines", { environment: environment() });
    expect(response.status).toBe(405);
    expect(requests.length).toBe(count);
  });
  it("retains public SQL errors without redirecting or hiding them as empty data", async () => {
    const response = await publicDataResponse(new Request("https://app.invalid/api/public-data/donations?select=missing_column"), "donations", { environment: environment() });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("42703");
  });
});
