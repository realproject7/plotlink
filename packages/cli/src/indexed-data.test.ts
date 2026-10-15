// @vitest-environment node
import { afterAll, beforeAll, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readIndexedStoryline } from "./indexed-data";
let server: Server;
let url: string;
let last: { url: string; auth?: string; apikey?: string };
beforeAll(async () => {
  server = createServer((request, response) => {
    last = { url: request.url!, auth: request.headers.authorization, apikey: request.headers.apikey as string | undefined };
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ title: "Fixture story", plot_count: 3 }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
it("reads the app API without any wallet or gateway credential", async () => {
  expect((await readIndexedStoryline({ apiUrl: url }, 17, "0xABC"))?.title).toBe("Fixture story");
  const request = new URL(last.url, url);
  expect(request.pathname).toBe("/api/public-data/storylines");
  expect(request.searchParams.get("contract_address")).toBe("eq.0xabc");
  expect(last.auth).toBeUndefined();expect(last.apikey).toBeUndefined();
});
it("keeps explicitly configured legacy cloud reads", async () => {
  await readIndexedStoryline({ supabaseUrl: url, supabaseAnonKey: "public-fixture" }, 17, "0xABC");
  expect(new URL(last.url, url).pathname).toBe("/rest/v1/storylines");
  expect(last.auth).toBe("Bearer public-fixture");
});
it("leaves unconfigured indexed reads to the existing chain fallback", async () => {
  expect(await readIndexedStoryline({}, 17, "0xABC")).toBeNull();
});
