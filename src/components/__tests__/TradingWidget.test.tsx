import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

afterEach(cleanup);

// Mock wagmi hooks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseAccount = vi.fn((): any => ({ address: undefined, isConnected: false }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseBalance = vi.fn((): any => ({ data: undefined, refetch: vi.fn() }));
vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
  useBalance: () => mockUseBalance(),
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, refetch: vi.fn() }),
}));

vi.mock("../../../lib/rpc", () => ({
  browserClient: { multicall: vi.fn(), readContract: vi.fn(), simulateContract: vi.fn() },
}));

vi.mock("../../../lib/price", () => ({
  mcv2BondAbi: [],
  erc20Abi: [],
}));

vi.mock("../../../lib/zap", () => ({
  getZapQuote: vi.fn(),
  buildZapMintTx: vi.fn(),
}));

// Mock constants with zap enabled (non-zero address)
vi.mock("../../../lib/contracts/constants", () => ({
  MCV2_BOND: "0xc5a076cad94176c2996B32d8466Be1cE757FAa27",
  PLOT_TOKEN: "0xF8A2C39111FCEB9C950aAf28A9E34EBaD99b85C1",
  RESERVE_LABEL: "PLOT",
  EXPLORER_URL: "https://basescan.org",
  ZAP_PLOTLINK: "0xEF6a8640c836b16Eb8cCD8016Ead4C8517aC3033",
  ETH_ADDRESS: "0x0000000000000000000000000000000000000000",
  SUPPORTED_ZAP_TOKENS: [
    { symbol: "ETH", address: "0x0000000000000000000000000000000000000000", decimals: 18 },
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    { symbol: "HUNT", address: "0x37f0c2915CeCC7e977183B8543Fc0864d03E064C", decimals: 18 },
  ],
}));

import { TradingWidget } from "../TradingWidget";

const TOKEN = "0x1234567890123456789012345678901234567890" as const;

describe("TradingWidget", () => {
  it("returns null when wallet is not connected", () => {
    mockUseAccount.mockReturnValue({ address: undefined, isConnected: false });
    const { container } = render(<TradingWidget tokenAddress={TOKEN} />);
    expect(container.innerHTML).toBe("");
  });

  describe("connected", () => {
    beforeEach(() => {
      mockUseAccount.mockReturnValue({
        address: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
        isConnected: true,
      });
      mockUseBalance.mockReturnValue({ data: { value: BigInt(1e18) }, refetch: vi.fn() });
    });

    it("renders buy/sell tab toggle", () => {
      render(<TradingWidget tokenAddress={TOKEN} />);
      expect(screen.getByText("Buy")).toBeInTheDocument();
      expect(screen.getByText("Sell")).toBeInTheDocument();
    });

    it("renders pay token selector with all 4 options (ETH, USDC, HUNT, PLOT)", () => {
      render(<TradingWidget tokenAddress={TOKEN} />);
      expect(screen.getByText("ETH")).toBeInTheDocument();
      expect(screen.getByText("USDC")).toBeInTheDocument();
      expect(screen.getByText("HUNT")).toBeInTheDocument();
      // PLOT shows as RESERVE_LABEL
      expect(screen.getByText("PLOT")).toBeInTheDocument();
    });

    it("renders amount input with placeholder", () => {
      render(<TradingWidget tokenAddress={TOKEN} />);
      expect(screen.getByPlaceholderText("0.0")).toBeInTheDocument();
    });

    it("validates amount input accepts numbers", () => {
      render(<TradingWidget tokenAddress={TOKEN} />);
      const input = screen.getByPlaceholderText("0.0");
      fireEvent.change(input, { target: { value: "100" } });
      expect(input).toHaveValue("100");
    });

    it("switches between buy and sell tabs", () => {
      render(<TradingWidget tokenAddress={TOKEN} />);
      fireEvent.click(screen.getByText("Sell"));
      expect(screen.getByText("Tokens to sell")).toBeInTheDocument();
    });
  });
});
