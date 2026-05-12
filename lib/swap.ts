/**
 * ETH → PLOT swap for Base App users.
 *
 * Both quote and execution use SwapRouter02 `exactInputSingle` (V3)
 * so the displayed estimate matches the executed route. SwapRouter02
 * auto-wraps ETH when msg.value is sent.
 */

import { type Address, parseAbi } from "viem";
import { browserClient as publicClient } from "./rpc";
import { PLOT_TOKEN } from "./contracts/constants";

const WETH = "0x4200000000000000000000000000000000000006" as const;
const SWAP_ROUTER_02 = "0x2626664c2603336E57B271c5C0b26F421741e481" as const;
const SLIPPAGE_BPS = 300;
const POOL_FEE = 10000;

export const swapRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)",
]);

export interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  amountOutMin: bigint;
}

export async function getSwapQuote(ethAmount: bigint): Promise<SwapQuote> {
  const { result } = await publicClient.simulateContract({
    address: SWAP_ROUTER_02 as Address,
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: WETH,
        tokenOut: PLOT_TOKEN,
        fee: POOL_FEE,
        recipient: SWAP_ROUTER_02,
        amountIn: ethAmount,
        amountOutMinimum: BigInt(0),
        sqrtPriceLimitX96: BigInt(0),
      },
    ],
    value: ethAmount,
  });

  const amountOut = result;
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
        fee: POOL_FEE,
        recipient,
        amountIn: quote.amountIn,
        amountOutMinimum: quote.amountOutMin,
        sqrtPriceLimitX96: BigInt(0),
      },
    ] as const,
    value: quote.amountIn,
  };
}
