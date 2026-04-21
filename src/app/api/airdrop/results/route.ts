/**
 * Finalized campaign results (#894)
 * GET /api/airdrop/results
 *
 * Derives final distribution from pl_airdrop_proofs (written by finalize script).
 */

import { NextResponse } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";
import { AIRDROP_CONFIG } from "../../../../../lib/airdrop/config";
import { formatUnits } from "viem";

export async function GET() {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Read all finalized proof amounts
  const { data, error } = await supabase
    .from("pl_airdrop_proofs")
    .select("amount");

  if (error || !data || data.length === 0) {
    return NextResponse.json({ finalized: false });
  }

  // Sum all distributed amounts (stored as wei strings)
  let totalDistributedWei = BigInt(0);
  for (const row of data) {
    totalDistributedWei += BigInt(row.amount);
  }
  const distributedPlot = Number(formatUnits(totalDistributedWei, 18));

  const poolAmount = AIRDROP_CONFIG.POOL_AMOUNT;
  const burnedPlot = poolAmount - distributedPlot;

  // Determine milestone from distributed percentage
  const distributedPct = (distributedPlot / poolAmount) * 100;
  let milestone: string;
  if (distributedPct >= AIRDROP_CONFIG.MILESTONES.GOLD.pct - 0.1) {
    milestone = "Gold";
  } else if (distributedPct >= AIRDROP_CONFIG.MILESTONES.SILVER.pct - 0.1) {
    milestone = "Silver";
  } else if (distributedPct >= AIRDROP_CONFIG.MILESTONES.BRONZE.pct - 0.1) {
    milestone = "Bronze";
  } else {
    milestone = "None";
  }

  return NextResponse.json({
    finalized: true,
    milestone,
    distributedPct: Math.round(distributedPct),
    distributedPlot: Math.round(distributedPlot),
    burnedPlot: Math.round(burnedPlot),
    recipients: data.length,
  });
}
