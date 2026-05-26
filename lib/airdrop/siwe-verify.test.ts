import { describe, expect, it, vi, beforeEach } from "vitest";
import { SiweMessage } from "siwe";
import { privateKeyToAccount } from "viem/accounts";

const TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const account = privateKeyToAccount(TEST_KEY);

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_AIRDROP_MODE", "");
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_AIRDROP_MODE", "");
});

function buildMessage(overrides: Partial<SiweMessage> = {}): SiweMessage {
  return new SiweMessage({
    domain: "plotlink.xyz",
    address: account.address,
    statement: "PlotLink Buy-Back Sprint activation",
    uri: "https://plotlink.xyz/airdrop",
    version: "1",
    chainId: 8453,
    nonce: "abcd1234",
    issuedAt: new Date().toISOString(),
    ...overrides,
  });
}

async function signMessage(msg: SiweMessage): Promise<string> {
  const prepared = msg.prepareMessage();
  return account.signMessage({ message: prepared });
}

describe("verifySiweRequest", () => {
  it("accepts a valid signature within freshness window", async () => {
    const { verifySiweRequest } = await import("./siwe-verify");
    const msg = buildMessage();
    const sig = await signMessage(msg);
    const result = await verifySiweRequest(msg.prepareMessage(), sig);
    expect(result).toEqual({ ok: true, address: account.address.toLowerCase() });
  });

  it("rejects an invalid signature", async () => {
    const { verifySiweRequest } = await import("./siwe-verify");
    const msg = buildMessage();
    const badSig = "0x" + "ab".repeat(65);
    const result = await verifySiweRequest(msg.prepareMessage(), badSig);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_signature");
  });

  it("rejects wrong domain", async () => {
    const { verifySiweRequest } = await import("./siwe-verify");
    const msg = buildMessage({ domain: "evil.com" });
    const sig = await signMessage(msg);
    const result = await verifySiweRequest(msg.prepareMessage(), sig);
    expect(result).toEqual({ ok: false, error: "domain_mismatch" });
  });

  it("rejects wrong URI", async () => {
    const { verifySiweRequest } = await import("./siwe-verify");
    const msg = buildMessage({ uri: "https://evil.com/airdrop" });
    const sig = await signMessage(msg);
    const result = await verifySiweRequest(msg.prepareMessage(), sig);
    expect(result).toEqual({ ok: false, error: "uri_mismatch" });
  });

  it("rejects wrong chain ID", async () => {
    const { verifySiweRequest } = await import("./siwe-verify");
    const msg = buildMessage({ chainId: 1 });
    const sig = await signMessage(msg);
    const result = await verifySiweRequest(msg.prepareMessage(), sig);
    expect(result).toEqual({ ok: false, error: "chain_id_mismatch" });
  });

  it("rejects wrong statement", async () => {
    const { verifySiweRequest } = await import("./siwe-verify");
    const msg = buildMessage({ statement: "Wrong statement" });
    const sig = await signMessage(msg);
    const result = await verifySiweRequest(msg.prepareMessage(), sig);
    expect(result).toEqual({ ok: false, error: "statement_mismatch" });
  });

  it("rejects expired signature (older than SIGNATURE_FRESHNESS_MIN)", async () => {
    const { verifySiweRequest } = await import("./siwe-verify");
    const old = new Date(Date.now() - 15 * 60_000);
    const msg = buildMessage({ issuedAt: old.toISOString() });
    const sig = await signMessage(msg);
    const result = await verifySiweRequest(msg.prepareMessage(), sig);
    expect(result).toEqual({ ok: false, error: "expired" });
  });

  it("rejects signature issued in the future", async () => {
    const { verifySiweRequest } = await import("./siwe-verify");
    const future = new Date(Date.now() + 5 * 60_000);
    const msg = buildMessage({ issuedAt: future.toISOString() });
    const sig = await signMessage(msg);
    const result = await verifySiweRequest(msg.prepareMessage(), sig);
    expect(result).toEqual({ ok: false, error: "issued_in_future" });
  });

  it("rejects unparseable message", async () => {
    const { verifySiweRequest } = await import("./siwe-verify");
    const result = await verifySiweRequest("not a siwe message", "0x1234");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_message");
  });
});
