import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleInboundReferral, REFERRAL_STORAGE_KEY } from "./activation-helpers";

beforeEach(() => { localStorage.clear(); });

function mockFetch(status: number) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve({}),
  })) as unknown as typeof fetch;
}

function throwingFetch() {
  return vi.fn(async () => { throw new Error("network error"); }) as unknown as typeof fetch;
}

describe("handleInboundReferral", () => {
  it("does nothing when no ref in localStorage", async () => {
    const fn = mockFetch(200);
    await handleInboundReferral("msg", "sig", fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it("POSTs to register-referral with SIWE auth", async () => {
    localStorage.setItem(REFERRAL_STORAGE_KEY, "TESTCODE");
    const fn = mockFetch(200);
    await handleInboundReferral("mock-msg", "mock-sig", fn);
    expect(fn).toHaveBeenCalledWith(
      "/api/airdrop/register-referral",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("mock-msg"),
      }),
    );
    const body = JSON.parse((fn as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.message).toBe("mock-msg");
    expect(body.signature).toBe("mock-sig");
    expect(body.referralCode).toBe("TESTCODE");
  });

  it("clears localStorage on 200 success", async () => {
    localStorage.setItem(REFERRAL_STORAGE_KEY, "REF1");
    await handleInboundReferral("m", "s", mockFetch(200));
    expect(localStorage.getItem(REFERRAL_STORAGE_KEY)).toBeNull();
  });

  it("clears localStorage on 400 (self-referral)", async () => {
    localStorage.setItem(REFERRAL_STORAGE_KEY, "REF2");
    await handleInboundReferral("m", "s", mockFetch(400));
    expect(localStorage.getItem(REFERRAL_STORAGE_KEY)).toBeNull();
  });

  it("clears localStorage on 404 (code not found)", async () => {
    localStorage.setItem(REFERRAL_STORAGE_KEY, "REF3");
    await handleInboundReferral("m", "s", mockFetch(404));
    expect(localStorage.getItem(REFERRAL_STORAGE_KEY)).toBeNull();
  });

  it("clears localStorage on 409 (already referred)", async () => {
    localStorage.setItem(REFERRAL_STORAGE_KEY, "REF4");
    await handleInboundReferral("m", "s", mockFetch(409));
    expect(localStorage.getItem(REFERRAL_STORAGE_KEY)).toBeNull();
  });

  it("retains localStorage on 401 (transient auth error)", async () => {
    localStorage.setItem(REFERRAL_STORAGE_KEY, "REF5");
    await handleInboundReferral("m", "s", mockFetch(401));
    expect(localStorage.getItem(REFERRAL_STORAGE_KEY)).toBe("REF5");
  });

  it("retains localStorage on 500 (server error)", async () => {
    localStorage.setItem(REFERRAL_STORAGE_KEY, "REF6");
    await handleInboundReferral("m", "s", mockFetch(500));
    expect(localStorage.getItem(REFERRAL_STORAGE_KEY)).toBe("REF6");
  });

  it("retains localStorage on network failure", async () => {
    localStorage.setItem(REFERRAL_STORAGE_KEY, "REF7");
    await handleInboundReferral("m", "s", throwingFetch());
    expect(localStorage.getItem(REFERRAL_STORAGE_KEY)).toBe("REF7");
  });
});
