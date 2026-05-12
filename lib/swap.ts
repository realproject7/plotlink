/**
 * ETH → PLOT swap for Base App users.
 *
 * Uses the V4 Quoter for price estimates and the V3 SwapRouter02
 * for execution. SwapRouter02 auto-wraps ETH when msg.value is sent.
 */

import { type Address, parseAbi } from "viem";
import { browserClient as publicClient } from "./rpc";
import { UNISWAP_V4_QUOTER, PLOT_TOKEN } from "./contracts/constants";

const WETH = "0x4200000000000000000000000000000000000006" as const;
const SWAP_ROUTER_02 = "0x2626664c2603336E57B271c5C0b26F421741e481" as const;
const SLIPPAGE_BPS = 300;

const quoterAbi = parseAbi([
  "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
  "struct QuoteExactSingleParams { PoolKey poolKey; bool zeroForOne; uint128 exactAmount; bytes hookData; }",
  "function quoteExactInputSingle(QuoteExactSingleParams calldata params) external returns (uint256 amountOut, uint256 gasEstimate)",
]);

export const swapRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)",
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

export function buildSwapTx(quote: SwapQuote, recipient: Address) {
  return {
    address: SWAP_ROUTER_02 as Address,
    abi: swapRouterAbi,
    functionName: "exactInputSingle" as const,
    args: [
      {
        tokenIn: WETH,
        tokenOut: PLOT_TOKEN,
        fee: 10000,
        recipient,
        amountIn: quote.amountIn,
        amountOutMinimum: quote.amountOutMin,
        sqrtPriceLimitX96: BigInt(0),
      },
    ] as const,
    value: quote.amountIn,
  };
}
