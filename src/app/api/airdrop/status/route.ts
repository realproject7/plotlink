/**
 * Campaign status overview (#885)
 * GET /api/airdrop/status — no auth required
 */

import { NextResponse } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";
import { AIRDROP_CONFIG } from "../../../../../lib/airdrop/config";
import { getPlotUsdPrice } from "../../../../../lib/usd-price";

export async function GET() {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const now = new Date();
  const start = AIRDROP_CONFIG.CAMPAIGN_START;
  const end = AIRDROP_CONFIG.CAMPAIGN_END;
  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = Math.max(0, now.getTime() - start.getTime());
  const remainingMs = Math.max(0, end.getTime() - now.getTime());

  // Latest price: try pl_daily_prices first, fall back to live price
  const { data: latestPrice } = await supabase
    .from("pl_daily_prices")
    .select("price_usd, mcap_usd")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single();

  // Live price fallback when daily snapshots haven't been recorded yet
  const livePriceUsd = latestPrice?.price_usd ?? (await getPlotUsdPrice());

  // Total points earned + unique participants
  const { data: allPoints } = await supabase
    .from("pl_points")
    .select("address, points");

  let totalPointsEarned = 0;
  const uniqueAddresses = new Set<string>();
  for (const row of allPoints ?? []) {
    totalPointsEarned += row.points;
    uniqueAddresses.add(row.address);
  }
  const totalParticipants = uniqueAddresses.size;

  // Milestone status — use stored FDV or compute from live price
  const MAX_SUPPLY = 1_000_000;
  const currentFdv = latestPrice?.mcap_usd
    ? Number(latestPrice.mcap_usd)
    : livePriceUsd
      ? livePriceUsd * MAX_SUPPLY
      : 0;
  const milestones = {
    bronze: {
      mcap: AIRDROP_CONFIG.MILESTONES.BRONZE.mcap,
      pct: AIRDROP_CONFIG.MILESTONES.BRONZE.pct,
      reached: currentFdv >= AIRDROP_CONFIG.MILESTONES.BRONZE.mcap,
    },
    silver: {
      mcap: AIRDROP_CONFIG.MILESTONES.SILVER.mcap,
      pct: AIRDROP_CONFIG.MILESTONES.SILVER.pct,
      reached: currentFdv >= AIRDROP_CONFIG.MILESTONES.SILVER.mcap,
    },
    gold: {
      mcap: AIRDROP_CONFIG.MILESTONES.GOLD.mcap,
      pct: AIRDROP_CONFIG.MILESTONES.GOLD.pct,
      reached: currentFdv >= AIRDROP_CONFIG.MILESTONES.GOLD.mcap,
    },
    diamond: {
      mcap: AIRDROP_CONFIG.MILESTONES.DIAMOND.mcap,
      pct: AIRDROP_CONFIG.MILESTONES.DIAMOND.pct,
      reached: currentFdv >= AIRDROP_CONFIG.MILESTONES.DIAMOND.mcap,
    },
  };

  return NextResponse.json({
    campaignStart: start.toISOString().slice(0, 10),
    campaignEnd: end.toISOString().slice(0, 10),
    timeRemainingDays: Math.ceil(remainingMs / (1000 * 60 * 60 * 24)),
    timeElapsedPercent: totalMs > 0 ? Math.min(100, Math.round((elapsedMs / totalMs) * 100)) : 0,
    poolAmount: AIRDROP_CONFIG.POOL_AMOUNT,
    currentFdv,
    latestPriceUsd: livePriceUsd ?? null,
    milestones,
    totalPointsEarned,
    totalParticipants,
    lockerId: AIRDROP_CONFIG.LOCKER_ID,
  }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
  });
}
