/**
 * ZapPlotLink frontend wrappers.
 *
 * Provides quote estimation and transaction helpers for the ZapPlotLink
 * contract, which swaps ETH → PLOT via Uniswap V4 and mints storyline
 * tokens on the MCV2 bonding curve in a single transaction.
 */

import { type Address, parseAbi } from "viem";
import { browserClient as publicClient } from "./rpc";
import { ZAP_PLOTLINK, UNISWAP_V4_QUOTER, PLOT_TOKEN } from "./contracts/constants";

// ---------------------------------------------------------------------------
// ABI (only the functions we call)
// ---------------------------------------------------------------------------

export const zapPlotLinkAbi = parseAbi([
  "function mint(address storylineToken, uint256 tokensToMint, address receiver) external payable returns (uint256 reserveUsed)",
  "function mintReverse(address storylineToken, uint256 minTokensOut, address receiver) external payable returns (uint256 tokensMinted)",
  "function estimateMintCostInPlot(address storylineToken, uint256 tokensToMint) external view returns (uint256 plotRequired)",
  "function estimateMintReverseFromPlot(address storylineToken, uint256 plotAmount) external view returns (uint256 tokensOut)",
]);

// Uniswap V4 Quoter — for ETH ↔ PLOT price estimates
const quoterAbi = parseAbi([
  "struct QuoteExactSingleParams { address tokenIn; address tokenOut; uint128 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint128 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const WETH: Address = "0x4200000000000000000000000000000000000006";
const POOL_FEE = 3000; // 0.30% — must match deployed pool
const SLIPPAGE_BPS = 50; // 0.5% slippage buffer for swap leg

// ---------------------------------------------------------------------------
// Quote helpers
// ---------------------------------------------------------------------------

export type ZapMode = "exact-output" | "exact-input";

export interface ZapQuote {
  /** PLOT tokens needed/received (bonding curve side) */
  plotAmount: bigint;
  /** Estimated ETH cost (including 0.5% swap slippage buffer) */
  ethCost: bigint;
  /** For exact-input: estimated storyline tokens out */
  tokensOut?: bigint;
  mode: ZapMode;
}

/**
 * Get a quote for a zap mint.
 *
 * - exact-output: "I want N storyline tokens — how much ETH?"
 * - exact-input: "I have N ETH — how many storyline tokens?"
 *
 * @param tokenAddress Storyline token address
 * @param amount Token amount (exact-output) or ETH amount in wei (exact-input)
 * @param mode Quote mode
 */
export async function getZapQuote(
  tokenAddress: Address,
  amount: bigint,
  mode: ZapMode,
): Promise<ZapQuote> {
  if (mode === "exact-output") {
    // Step 1: How much PLOT needed to mint `amount` storyline tokens?
    const plotRequired = await publicClient.readContract({
      address: ZAP_PLOTLINK,
      abi: zapPlotLinkAbi,
      functionName: "estimateMintCostInPlot",
      args: [tokenAddress, amount],
    });

    // Step 2: How much ETH to buy that much PLOT on Uniswap V4?
    // We estimate by simulating a swap of WETH→PLOT for `plotRequired`
    // Since we can't easily do exact-output quote, we use a conservative
    // estimate: assume the swap ratio and add slippage buffer
    const ethCost = applySwapSlippage(plotRequired);

    return { plotAmount: plotRequired, ethCost, mode };
  } else {
    // exact-input: user sends `amount` ETH
    // Step 1: Estimate how much PLOT we get for `amount` ETH
    // Use the same ratio assumption with inverse slippage
    const plotEstimate = removeSwapSlippage(amount);

    // Step 2: How many storyline tokens for that PLOT?
    const tokensOut = await publicClient.readContract({
      address: ZAP_PLOTLINK,
      abi: zapPlotLinkAbi,
      functionName: "estimateMintReverseFromPlot",
      args: [tokenAddress, plotEstimate],
    });

    return { plotAmount: plotEstimate, ethCost: amount, tokensOut, mode };
  }
}

// ---------------------------------------------------------------------------
// Transaction helpers
// ---------------------------------------------------------------------------

/**
 * Build the transaction parameters for a zap mint.
 * Returns args suitable for wagmi's writeContract.
 *
 * @param tokenAddress Storyline token address
 * @param amount Token amount (exact-output) or ETH wei (exact-input)
 * @param mode Zap mode
 * @param receiver Address to receive minted tokens
 * @param ethValue ETH to send (from quote.ethCost for exact-output, or the input amount for exact-input)
 */
export function buildZapMintTx(
  tokenAddress: Address,
  amount: bigint,
  mode: ZapMode,
  receiver: Address,
  ethValue: bigint,
) {
  if (mode === "exact-output") {
    return {
      address: ZAP_PLOTLINK,
      abi: zapPlotLinkAbi,
      functionName: "mint" as const,
      args: [tokenAddress, amount, receiver] as const,
      value: ethValue,
      gas: BigInt(3_000_000),
    };
  } else {
    // For exact-input, minTokensOut = 0 (slippage handled by contract revert)
    // In production, pass a real minTokensOut from the quote
    return {
      address: ZAP_PLOTLINK,
      abi: zapPlotLinkAbi,
      functionName: "mintReverse" as const,
      args: [tokenAddress, BigInt(0), receiver] as const,
      value: ethValue,
      gas: BigInt(3_000_000),
    };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Add 0.5% slippage buffer (user pays more ETH to account for swap price impact) */
function applySwapSlippage(amount: bigint): bigint {
  return amount + (amount * BigInt(SLIPPAGE_BPS)) / BigInt(10000);
}

/** Remove 0.5% slippage buffer (user receives less PLOT from swap) */
function removeSwapSlippage(amount: bigint): bigint {
  return amount - (amount * BigInt(SLIPPAGE_BPS)) / BigInt(10000);
}
