/**
 * Server-side helper to fetch the current PLOT/USD exchange rate.
 *
 * Derivation: PLOT/USD = priceForNextMint(PLOT_TOKEN) in HUNT × HUNT/USD via 1inch oracle.
 *
 * Used by trade indexers to store `reserve_usd_rate` alongside each trade,
 * enabling USD-denominated price charts.
 */

import { formatEther } from "viem";
import { publicClient } from "./rpc";
import { MCV2_BOND, PLOT_TOKEN, HUNT } from "./contracts/constants";
import { priceForNextMintFunction } from "./contracts/abi";

const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as const;
const ONEINCH_SPOT_PRICE_AGGREGATOR = "0x00000000000D6FFc74A8feb35aF5827bf57f6786" as const;

const SPOT_PRICE_ABI = [
  {
    inputs: [
      { name: "srcToken", type: "address" },
      { name: "dstToken", type: "address" },
      { name: "useWrappers", type: "bool" },
    ],
    name: "getRate",
    outputs: [{ name: "weightedRate", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Fetch the current HUNT/USD rate from the 1inch spot price aggregator.
 * Returns USD price per 1 HUNT.
 */
export async function getHuntPriceUSD(
  client?: typeof publicClient,
): Promise<number> {
  const rpc = client ?? publicClient;
  const weightedRate = await rpc.readContract({
    address: ONEINCH_SPOT_PRICE_AGGREGATOR,
    abi: SPOT_PRICE_ABI,
    functionName: "getRate",
    args: [HUNT, USDC_ADDRESS, false],
  });
  // USDC has 6 decimals, HUNT has 18 → rate is scaled to 1e18
  // USD price = weightedRate / 1e6
  return Number(weightedRate) / 1_000_000;
}

/**
 * Fetch the current PLOT/USD rate.
 * PLOT/USD = priceForNextMint(PLOT_TOKEN) in HUNT × HUNT/USD.
 *
 * Returns null if the rate cannot be determined (RPC failure, etc.).
 */
export async function getReserveUsdRate(
  client?: typeof publicClient,
): Promise<number | null> {
  try {
    const rpc = client ?? publicClient;
    const [plotInHuntWei, huntUsd] = await Promise.all([
      rpc.readContract({
        address: MCV2_BOND,
        abi: [priceForNextMintFunction],
        functionName: "priceForNextMint",
        args: [PLOT_TOKEN],
      }),
      getHuntPriceUSD(rpc),
    ]);
    const plotInHunt = Number(formatEther(BigInt(plotInHuntWei)));
    return plotInHunt * huntUsd;
  } catch (err) {
    console.error(
      "[reserve-usd-rate] Failed to fetch PLOT/USD:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
