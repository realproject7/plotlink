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

/**
 * V4 Quoter ABI — quoteExactInputSingle and quoteExactOutputSingle.
 *
 * These functions are NOT view — they execute state changes internally and
 * revert with the result. Must be called via eth_call (simulateContract).
 */
const quoterAbi = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          {
            name: "poolKey",
            type: "tuple",
            components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
            ],
          },
          { name: "zeroForOne", type: "bool" },
          { name: "exactAmount", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
  {
    name: "quoteExactOutputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          {
            name: "poolKey",
            type: "tuple",
            components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
            ],
          },
          { name: "zeroForOne", type: "bool" },
          { name: "exactAmount", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "amountIn", type: "uint256" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

const WETH: Address = "0x4200000000000000000000000000000000000006";
const POOL_FEE = 3000; // 0.30% — must match deployed pool
const TICK_SPACING = 60;
const HOOKS: Address = "0x0000000000000000000000000000000000000000";
const SLIPPAGE_BPS = 50; // 0.5% slippage buffer

// Pool key tokens sorted (currency0 < currency1)
function getPoolKey(): { currency0: Address; currency1: Address } {
  const wethNum = BigInt(WETH);
  const plotNum = BigInt(PLOT_TOKEN);
  if (wethNum < plotNum) {
    return { currency0: WETH, currency1: PLOT_TOKEN };
  }
  return { currency0: PLOT_TOKEN, currency1: WETH };
}

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
 * Quote how much PLOT is received for a given ETH input via Uniswap V4.
 * Uses the V4 Quoter's quoteExactInputSingle (called via eth_call).
 */
async function quoteEthToPlot(ethAmount: bigint): Promise<bigint> {
  const { currency0, currency1 } = getPoolKey();
  const zeroForOne = currency0 === WETH; // true if WETH is currency0

  try {
    const { result } = await publicClient.simulateContract({
      address: UNISWAP_V4_QUOTER as Address,
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          poolKey: { currency0, currency1, fee: POOL_FEE, tickSpacing: TICK_SPACING, hooks: HOOKS },
          zeroForOne,
          exactAmount: ethAmount,
          hookData: "0x",
        },
      ],
    });
    return result[0];
  } catch {
    // Fallback: if quoter call fails, return 0 to indicate unavailable
    return BigInt(0);
  }
}

/**
 * Quote how much ETH is needed to buy a given amount of PLOT via Uniswap V4.
 * Uses the V4 Quoter's quoteExactOutputSingle (called via eth_call).
 */
async function quotePlotToEth(plotAmount: bigint): Promise<bigint> {
  const { currency0, currency1 } = getPoolKey();
  const zeroForOne = currency0 === WETH; // swapping WETH in for PLOT out

  try {
    const { result } = await publicClient.simulateContract({
      address: UNISWAP_V4_QUOTER as Address,
      abi: quoterAbi,
      functionName: "quoteExactOutputSingle",
      args: [
        {
          poolKey: { currency0, currency1, fee: POOL_FEE, tickSpacing: TICK_SPACING, hooks: HOOKS },
          zeroForOne,
          exactAmount: plotAmount,
          hookData: "0x",
        },
      ],
    });
    return result[0];
  } catch {
    return BigInt(0);
  }
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
    const ethNeeded = await quotePlotToEth(plotRequired);

    // Add 0.5% slippage buffer
    const ethCost = ethNeeded > BigInt(0)
      ? ethNeeded + (ethNeeded * BigInt(SLIPPAGE_BPS)) / BigInt(10000)
      : BigInt(0);

    return { plotAmount: plotRequired, ethCost, mode };
  } else {
    // exact-input: user sends `amount` ETH
    // Step 1: How much PLOT do we get for `amount` ETH via Uniswap V4?
    const plotReceived = await quoteEthToPlot(amount);

    // Step 2: How many storyline tokens for that PLOT?
    let tokensOut = BigInt(0);
    if (plotReceived > BigInt(0)) {
      tokensOut = await publicClient.readContract({
        address: ZAP_PLOTLINK,
        abi: zapPlotLinkAbi,
        functionName: "estimateMintReverseFromPlot",
        args: [tokenAddress, plotReceived],
      });
    }

    return { plotAmount: plotReceived, ethCost: amount, tokensOut, mode };
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
 * @param ethValue ETH to send (from quote.ethCost)
 * @param minTokensOut Minimum tokens for exact-input slippage protection
 */
export function buildZapMintTx(
  tokenAddress: Address,
  amount: bigint,
  mode: ZapMode,
  receiver: Address,
  ethValue: bigint,
  minTokensOut?: bigint,
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
    // Apply 3% slippage to minTokensOut for exact-input protection
    const minOut = minTokensOut ?? BigInt(0);
    const slippageProtected = minOut > BigInt(0)
      ? minOut - (minOut * BigInt(300)) / BigInt(10000)
      : BigInt(0);

    return {
      address: ZAP_PLOTLINK,
      abi: zapPlotLinkAbi,
      functionName: "mintReverse" as const,
      args: [tokenAddress, slippageProtected, receiver] as const,
      value: ethValue,
      gas: BigInt(3_000_000),
    };
  }
}

/**
 * Execute a zap mint end-to-end: get quote, then submit transaction.
 *
 * @param tokenAddress Storyline token address
 * @param amount Token amount (exact-output) or ETH amount in wei (exact-input)
 * @param mode Zap mode
 * @param receiver Address to receive minted tokens
 * @param writeContractAsync wagmi writeContractAsync function
 * @returns Transaction hash
 */
export async function executeZapMint(
  tokenAddress: Address,
  amount: bigint,
  mode: ZapMode,
  receiver: Address,
  writeContractAsync: (args: ReturnType<typeof buildZapMintTx>) => Promise<Address>,
): Promise<Address> {
  const quote = await getZapQuote(tokenAddress, amount, mode);
  const tx = buildZapMintTx(
    tokenAddress,
    amount,
    mode,
    receiver,
    quote.ethCost,
    quote.tokensOut,
  );
  return writeContractAsync(tx);
}
