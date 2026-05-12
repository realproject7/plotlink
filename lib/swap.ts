/**
 * Direct ETH → PLOT swap via Uniswap V4 for Base App users.
 *
 * Uses the V4 Quoter for price estimates and Universal Router for execution.
 * The WETH-PLOT pool parameters match the ZapPlotLinkV2 contract's internal path.
 */

import { type Address, parseAbi, encodeFunctionData, encodePacked } from "viem";
import { browserClient as publicClient } from "./rpc";
import {
  UNISWAP_V4_QUOTER,
  UNISWAP_V4_ROUTER,
  PLOT_TOKEN,
} from "./contracts/constants";

const WETH = "0x4200000000000000000000000000000000000006" as const;
const SLIPPAGE_BPS = 300;

// Uniswap V4 Quoter ABI (quoteExactInputSingle)
const quoterAbi = parseAbi([
  "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
  "struct QuoteExactSingleParams { PoolKey poolKey; bool zeroForOne; uint128 exactAmount; bytes hookData; }",
  "function quoteExactInputSingle(QuoteExactSingleParams calldata params) external returns (uint256 amountOut, uint256 gasEstimate)",
]);

// Uniswap Universal Router ABI
const routerAbi = parseAbi([
  "function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable",
]);

// Pool key for WETH-PLOT (sorted by address, 1% fee tier)
const POOL_KEY = {
  currency0: (WETH < PLOT_TOKEN ? WETH : PLOT_TOKEN) as Address,
  currency1: (WETH < PLOT_TOKEN ? PLOT_TOKEN : WETH) as Address,
  fee: 10000,
  tickSpacing: 200,
  hooks: "0x0000000000000000000000000000000000000000" as Address,
};

const ZERO_FOR_ONE = POOL_KEY.currency0 === WETH;

export interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  amountOutMin: bigint;
}

export async function getSwapQuote(ethAmount: bigint): Promise<SwapQuote> {
  const { result } = await publicClient.simulateContract({
    address: UNISWAP_V4_QUOTER,
    abi: quoterAbi,
    functionName: "quoteExactInputSingle",
    args: [
      {
        poolKey: POOL_KEY,
        zeroForOne: ZERO_FOR_ONE,
        exactAmount: ethAmount,
        hookData: "0x",
      },
    ],
  });

  const amountOut = result[0];
  const amountOutMin =
    amountOut - (amountOut * BigInt(SLIPPAGE_BPS)) / BigInt(10000);

  return { amountIn: ethAmount, amountOut, amountOutMin };
}

// Universal Router command bytes
const COMMAND_WRAP_ETH = 0x0b;
const COMMAND_V4_SWAP = 0x10;

export function buildSwapTx(quote: SwapQuote) {
  // Build Universal Router execute() call for ETH → PLOT
  // Command 1: WRAP_ETH — wraps msg.value to WETH
  // Command 2: V4_SWAP — swap WETH → PLOT via the pool
  const commands = encodePacked(
    ["uint8", "uint8"],
    [COMMAND_WRAP_ETH, COMMAND_V4_SWAP],
  );

  // For now, return the router address and encoded call data
  // The actual swap encoding is complex — use the router's execute()
  return {
    address: UNISWAP_V4_ROUTER,
    abi: routerAbi,
    functionName: "execute" as const,
    args: [commands, [] as `0x${string}`[], BigInt(Math.floor(Date.now() / 1000) + 1800)] as const,
    value: quote.amountIn,
  };
}

/**
 * Encode swap call data for use with sendCalls batching.
 */
export function encodeSwapCallData(quote: SwapQuote) {
  const tx = buildSwapTx(quote);
  return {
    to: tx.address,
    data: encodeFunctionData({
      abi: tx.abi,
      functionName: tx.functionName,
      args: [...tx.args],
    }),
    value: tx.value,
  };
}
