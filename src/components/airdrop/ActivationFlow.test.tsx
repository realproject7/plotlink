// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSignMessageAsync = vi.fn().mockResolvedValue("0xmocksig");
const mockHandleInboundReferral = vi.fn().mockResolvedValue(undefined);

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0xABC123", chainId: 8453 }),
  useSignMessage: () => ({ signMessageAsync: mockSignMessageAsync }),
}));

vi.mock("siwe", () => ({
  SiweMessage: class {
    prepareMessage() { return "mock-siwe-message"; }
  },
}));

vi.mock("../../../lib/airdrop/activation-helpers", () => ({
  handleInboundReferral: (...args: unknown[]) => mockHandleInboundReferral(...args),
}));

let activationStatus = { x_handle_confirmed_at: null as string | null, x_follow_at: null as string | null, fc_verified_at: null, activated_at: null };

beforeEach(() => {
  activationStatus = { x_handle_confirmed_at: null, x_follow_at: null, fc_verified_at: null, activated_at: null };
  mockSignMessageAsync.mockResolvedValue("0xmocksig");
  mockHandleInboundReferral.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(activationStatus),
  } as Response)));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

import { ActivationFlow } from "./ActivationFlow";

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

  it("clicking Sign & Activate calls signMessageAsync and handleInboundReferral", async () => {
    render(<ActivationFlow />);
    const btns = await waitFor(() => screen.getAllByText("Sign & Activate"));
    await userEvent.click(btns[0]);

    await waitFor(() => {
      expect(mockSignMessageAsync).toHaveBeenCalledWith({ message: "mock-siwe-message" });
    });

    await waitFor(() => {
      expect(mockHandleInboundReferral).toHaveBeenCalledWith("mock-siwe-message", "0xmocksig");
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/@handle/i)).toBeDefined();
    });
  });

  it("shows error when signature rejected by user", async () => {
    mockSignMessageAsync.mockRejectedValue(new Error("User rejected the request"));
    render(<ActivationFlow />);
    const btns = await waitFor(() => screen.getAllByText("Sign & Activate"));
    await userEvent.click(btns[0]);
    await waitFor(() => {
      expect(screen.getByText(/Signature rejected/i)).toBeDefined();
    });
  });

  it("shows generic error on non-rejection sign failure", async () => {
    mockSignMessageAsync.mockRejectedValue(new Error("Unknown wallet error"));
    render(<ActivationFlow />);
    const btns = await waitFor(() => screen.getAllByText("Sign & Activate"));
    await userEvent.click(btns[0]);
    await waitFor(() => {
      expect(screen.getByText(/Failed to sign/i)).toBeDefined();
    });
  });
});
