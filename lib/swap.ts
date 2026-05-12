/**
 * ETH → PLOT swap quote via Uniswap V4 Quoter for Base App users.
 *
 * Provides price estimates for the swap widget. Execution uses
 * the Uniswap web UI within Base App's webview, since the Universal
 * Router's V4 swap encoding requires the Uniswap SDK for proper
 * action/param serialization.
 */

import { type Address, parseAbi } from "viem";
import { browserClient as publicClient } from "./rpc";
import { UNISWAP_V4_QUOTER, PLOT_TOKEN } from "./contracts/constants";

const WETH = "0x4200000000000000000000000000000000000006" as const;
const SLIPPAGE_BPS = 300;

const quoterAbi = parseAbi([
  "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
  "struct QuoteExactSingleParams { PoolKey poolKey; bool zeroForOne; uint128 exactAmount; bytes hookData; }",
  "function quoteExactInputSingle(QuoteExactSingleParams calldata params) external returns (uint256 amountOut, uint256 gasEstimate)",
]);

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
