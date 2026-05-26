// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ActivationFlow } from "./ActivationFlow";

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0xABC123", chainId: 8453 }),
  useSignMessage: () => ({ signMessageAsync: vi.fn().mockResolvedValue("0xmocksig") }),
}));

vi.mock("siwe", () => ({
  SiweMessage: class {
    prepareMessage() { return "mock-siwe-message"; }
  },
}));

let activationStatus = { x_handle_confirmed_at: null as string | null, x_follow_at: null as string | null, fc_verified_at: null, activated_at: null };

beforeEach(() => {
  activationStatus = { x_handle_confirmed_at: null, x_follow_at: null, fc_verified_at: null, activated_at: null };
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(activationStatus),
  } as Response)));
});

afterEach(() => { vi.unstubAllGlobals(); });

describe("ActivationFlow", () => {
  it("renders step 1 (SIWE sign) when not activated", async () => {
    render(<ActivationFlow />);
    await waitFor(() => {
      expect(screen.getByText("Sign & Activate")).toBeDefined();
    });
  });

  it("skips to step 3 (missions) when x_handle already confirmed", async () => {
    activationStatus = { x_handle_confirmed_at: "2026-07-01", x_follow_at: null, fc_verified_at: null, activated_at: null };
    render(<ActivationFlow />);
    await waitFor(() => {
      expect(screen.getByText(/Follow @plotlinkxyz/i)).toBeDefined();
    });
  });

  it("shows FC follow as optional in step 3", async () => {
    activationStatus = { x_handle_confirmed_at: "2026-07-01", x_follow_at: null, fc_verified_at: null, activated_at: null };
    render(<ActivationFlow />);
    await waitFor(() => {
      expect(screen.getByText(/optional/i)).toBeDefined();
    });
  });

  it("shows X follow as done when x_follow_at present", async () => {
    activationStatus = { x_handle_confirmed_at: "2026-07-01", x_follow_at: "2026-07-02", fc_verified_at: null, activated_at: null };
    render(<ActivationFlow />);
    await waitFor(() => {
      const dones = screen.getAllByText(/Done/i);
      expect(dones.length).toBeGreaterThan(0);
    });
  });
});
