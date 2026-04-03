#!/usr/bin/env npx tsx
/**
 * Backfill trade_history.reserve_usd_rate with PLOT/USD rates.
 *
 * Strategy (tiered):
 *   1. Try exact historical read: priceForNextMint(PLOT_TOKEN) at trade block × HUNT/USD.
 *      Some public RPCs (mainnet.base.org, base.drpc.org) support historical state.
 *   2. Fallback: current PLOT/HUNT ratio × historical daily HUNT/USD from CoinGecko.
 *      Marked as 'backfill_approx' — PLOT/HUNT ratio shifts with bonding curve supply,
 *      so this is directionally correct but not precise for older trades.
 *
 * Usage:
 *   npx tsx scripts/backfill-usd-rates.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { createPublicClient, formatEther, http, type PublicClient } from "viem";
import { base } from "viem/chains";
import {
  MCV2_BOND,
  PLOT_TOKEN,
  HUNT,
  USDC,
  ONEINCH_SPOT_PRICE_AGGREGATOR,
} from "../lib/contracts/constants";
import { priceForNextMintFunction, spotPriceAbi } from "../lib/contracts/abi";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// RPCs known to support historical state reads on Base
const ARCHIVE_RPCS = [
  "https://mainnet.base.org",
  "https://base.drpc.org",
];

/**
 * Try to read PLOT/USD at a historical block using archive-capable RPCs.
 * Returns { rate, source: 'backfill_exact' } or null if all RPCs fail.
 */
async function getExactHistoricalRate(blockNumber: bigint): Promise<number | null> {
  for (const rpcUrl of ARCHIVE_RPCS) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(rpcUrl, { timeout: 5_000, retryCount: 0 }),
      }) as PublicClient;

      const [plotInHuntWei, huntUsdRate] = await Promise.all([
        client.readContract({
          address: MCV2_BOND,
          abi: [priceForNextMintFunction],
          functionName: "priceForNextMint",
          args: [PLOT_TOKEN],
          blockNumber,
        }),
        client.readContract({
          address: ONEINCH_SPOT_PRICE_AGGREGATOR,
          abi: spotPriceAbi,
          functionName: "getRate",
          args: [HUNT, USDC, false],
          blockNumber,
        }),
      ]);

      const plotInHunt = Number(formatEther(BigInt(plotInHuntWei)));
      const huntUsd = Number(huntUsdRate) / 1_000_000;
      return plotInHunt * huntUsd;
    } catch {
      // Try next RPC
      continue;
    }
  }
  return null;
}

/**
 * Fetch current PLOT/USD as approximate fallback.
 */
async function getCurrentPlotUsd(): Promise<number | null> {
  const client = createPublicClient({
    chain: base,
    transport: http(ARCHIVE_RPCS[0], { timeout: 5_000, retryCount: 1 }),
  }) as PublicClient;

  try {
    const [plotInHuntWei, huntUsdRate] = await Promise.all([
      client.readContract({
        address: MCV2_BOND,
        abi: [priceForNextMintFunction],
        functionName: "priceForNextMint",
        args: [PLOT_TOKEN],
      }),
      client.readContract({
        address: ONEINCH_SPOT_PRICE_AGGREGATOR,
        abi: spotPriceAbi,
        functionName: "getRate",
        args: [HUNT, USDC, false],
      }),
    ]);
    const plotInHunt = Number(formatEther(BigInt(plotInHuntWei)));
    const huntUsd = Number(huntUsdRate) / 1_000_000;
    return plotInHunt * huntUsd;
  } catch {
    return null;
  }
}

async function main() {
  console.log("=== Backfill USD Rates ===");

  // Fetch trades missing reserve_usd_rate
  const { data: trades, error: fetchError } = await supabase
    .from("trade_history")
    .select("id, block_number, block_timestamp")
    .is("reserve_usd_rate", null)
    .order("block_number", { ascending: true });

  if (fetchError) {
    console.error("Failed to fetch trades:", fetchError.message);
    process.exit(1);
  }

  if (!trades || trades.length === 0) {
    console.log("No trades need USD rate backfill.");
    return;
  }

  console.log(`Found ${trades.length} trades missing USD rates.`);

  // Get current rate as approximate fallback
  const approxRate = await getCurrentPlotUsd();
  if (approxRate !== null) {
    console.log(`Current PLOT/USD (approx fallback): $${approxRate.toFixed(8)}`);
  } else {
    console.warn("WARNING: Could not fetch current PLOT/USD — skipping approximate fallback");
  }

  let exact = 0;
  let approx = 0;
  let failed = 0;

  // Group trades by block to minimize RPC calls
  const blockGroups = new Map<number, typeof trades>();
  for (const trade of trades) {
    const group = blockGroups.get(trade.block_number) || [];
    group.push(trade);
    blockGroups.set(trade.block_number, group);
  }

  console.log(`Trades span ${blockGroups.size} unique blocks.`);

  for (const [blockNumber, blockTrades] of blockGroups) {
    // Try exact historical rate for this block
    const exactRate = await getExactHistoricalRate(BigInt(blockNumber));

    const rate = exactRate ?? approxRate;
    const source = exactRate !== null ? "backfill_exact" : "backfill_approx";

    if (rate === null) {
      console.error(`  [SKIP] block=${blockNumber}: no rate available`);
      failed += blockTrades.length;
      continue;
    }

    // Update all trades in this block
    const ids = blockTrades.map((t) => t.id);
    const { error: updateError } = await supabase
      .from("trade_history")
      .update({ reserve_usd_rate: rate, rate_source: source })
      .in("id", ids);

    if (updateError) {
      console.error(`  [FAIL] block=${blockNumber}: ${updateError.message}`);
      failed += blockTrades.length;
    } else {
      if (source === "backfill_exact") {
        exact += blockTrades.length;
      } else {
        approx += blockTrades.length;
      }
      if (blockGroups.size <= 50 || exact + approx <= 10) {
        console.log(`  [${source.toUpperCase()}] block=${blockNumber} rate=$${rate.toFixed(8)} (${blockTrades.length} trades)`);
      }
    }

    // Delay between blocks to avoid RPC rate limits
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("");
  console.log("=== Backfill complete ===");
  console.log(`  Exact:       ${exact}`);
  console.log(`  Approximate: ${approx}`);
  console.log(`  Failed:      ${failed}`);
  console.log(`  Total:       ${trades.length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
