/**
 * Daily price snapshot cron (#890)
 *
 * Records PLOT USD price, circulating supply, and mcap for TWAP calculation.
 * Schedule: once/day at midnight UTC (0 0 * * *)
 */

import { NextResponse } from "next/server";
import { formatUnits } from "viem";
import { createServerClient } from "../../../../../lib/supabase";
import { getPlotUsdPrice } from "../../../../../lib/usd-price";
import { publicClient } from "../../../../../lib/rpc";
import { PLOT_TOKEN } from "../../../../../lib/contracts/constants";
import { erc20Abi } from "../../../../../lib/price";

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const todayUtc = new Date().toISOString().slice(0, 10);

  // Idempotency: skip if today already has an entry
  const { data: existing } = await supabase
    .from("pl_daily_prices")
    .select("id")
    .eq("recorded_at", todayUtc)
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({ skipped: true, reason: "Entry already exists for today" });
  }

  // Fetch price — skip snapshot entirely if price fetch fails
  const priceUsd = await getPlotUsdPrice(true);
  if (priceUsd === null) {
    console.error("[airdrop-price] Price fetch returned null — skipping snapshot for", todayUtc);
    return NextResponse.json({ skipped: true, reason: "Price fetch failed" }, { status: 200 });
  }

  // Fetch circulating supply from on-chain
  let supplyFormatted: number;
  try {
    const totalSupplyRaw = await publicClient.readContract({
      address: PLOT_TOKEN,
      abi: erc20Abi,
      functionName: "totalSupply",
    }) as bigint;
    supplyFormatted = Number(formatUnits(totalSupplyRaw, 18));
  } catch (err) {
    console.error("[airdrop-price] Failed to fetch supply:", err);
    return NextResponse.json({ skipped: true, reason: "Supply fetch failed" }, { status: 200 });
  }

  const mcapUsd = priceUsd * supplyFormatted;

  const { error } = await supabase.from("pl_daily_prices").insert({
    recorded_at: todayUtc,
    price_usd: priceUsd,
    supply: supplyFormatted,
    mcap_usd: mcapUsd,
  });

  if (error) {
    console.error("[airdrop-price] Insert failed:", error.message);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  console.info(`[airdrop-price] Snapshot recorded: date=${todayUtc} price=${priceUsd} supply=${supplyFormatted} mcap=${mcapUsd}`);
  return NextResponse.json({ recorded: true, date: todayUtc, priceUsd, supply: supplyFormatted, mcapUsd });
}
