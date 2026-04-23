/**
 * Weekly snapshot history (#885)
 * GET /api/airdrop/snapshots
 */

import { NextResponse } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";

export async function GET() {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data: snapshots, error } = await supabase
    .from("pl_weekly_snapshots")
    .select("week_number, week_start, new_stories, token_buys, new_referrals, mcap_start, mcap_end, total_pl_earned")
    .order("week_number", { ascending: false });

  if (error) {
    console.error("[airdrop/snapshots] Query failed:", error.message);
    return NextResponse.json({ error: "Failed to fetch snapshots" }, { status: 500 });
  }

  return NextResponse.json({
    snapshots: (snapshots ?? []).map((s) => ({
      weekNumber: s.week_number,
      weekStart: s.week_start,
      newStories: s.new_stories,
      tokenBuys: s.token_buys,
      newReferrals: s.new_referrals,
      mcapStart: s.mcap_start,
      mcapEnd: s.mcap_end,
      totalPlEarned: s.total_pl_earned,
    })),
  }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
  });
}
