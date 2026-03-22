import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

afterEach(cleanup);

// Mock only wagmi (wallet layer, not RPC) — per spec: test disconnected state
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useBalance: () => ({ data: undefined, refetch: vi.fn() }),
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, refetch: vi.fn() }),
}));

// Minimal module stubs so the component can be imported (not mocking RPC behavior)
vi.mock("../../../lib/rpc", () => ({
  browserClient: {},
}));

vi.mock("../../../lib/price", () => ({
  mcv2BondAbi: [],
  erc20Abi: [],
}));

vi.mock("../../../lib/zap", () => ({
  getZapQuote: vi.fn(),
  buildZapMintTx: vi.fn(),
}));

import { TradingWidget } from "../TradingWidget";

const TOKEN = "0x1234567890123456789012345678901234567890" as const;

describe("TradingWidget", () => {
  it("returns null when wallet is not connected (isConnected = false)", () => {
    const { container } = render(<TradingWidget tokenAddress={TOKEN} />);
    expect(container.innerHTML).toBe("");
  });
});
