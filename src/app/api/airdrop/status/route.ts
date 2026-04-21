/**
 * Campaign status overview (#885)
 * GET /api/airdrop/status — no auth required
 */

import { NextResponse } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";
import { AIRDROP_CONFIG } from "../../../../../lib/airdrop/config";

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

  // Latest price from pl_daily_prices
  const { data: latestPrice } = await supabase
    .from("pl_daily_prices")
    .select("price_usd, mcap_usd")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single();

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

  // Milestone status
  const currentMcap = latestPrice?.mcap_usd ?? 0;
  const milestones = {
    bronze: {
      mcap: AIRDROP_CONFIG.MILESTONES.BRONZE.mcap,
      pct: AIRDROP_CONFIG.MILESTONES.BRONZE.pct,
      reached: currentMcap >= AIRDROP_CONFIG.MILESTONES.BRONZE.mcap,
    },
    silver: {
      mcap: AIRDROP_CONFIG.MILESTONES.SILVER.mcap,
      pct: AIRDROP_CONFIG.MILESTONES.SILVER.pct,
      reached: currentMcap >= AIRDROP_CONFIG.MILESTONES.SILVER.mcap,
    },
    gold: {
      mcap: AIRDROP_CONFIG.MILESTONES.GOLD.mcap,
      pct: AIRDROP_CONFIG.MILESTONES.GOLD.pct,
      reached: currentMcap >= AIRDROP_CONFIG.MILESTONES.GOLD.mcap,
    },
  };

  return NextResponse.json({
    campaignStart: start.toISOString().slice(0, 10),
    campaignEnd: end.toISOString().slice(0, 10),
    timeRemainingDays: Math.ceil(remainingMs / (1000 * 60 * 60 * 24)),
    timeElapsedPercent: totalMs > 0 ? Math.min(100, Math.round((elapsedMs / totalMs) * 100)) : 0,
    poolAmount: AIRDROP_CONFIG.POOL_AMOUNT,
    currentMcap,
    latestPriceUsd: latestPrice?.price_usd ?? null,
    milestones,
    totalPointsEarned,
    totalParticipants,
    lockerId: AIRDROP_CONFIG.LOCKER_ID,
  });
}
