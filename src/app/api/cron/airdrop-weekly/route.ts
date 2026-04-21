/**
 * Weekly stats snapshot cron (#891)
 *
 * Aggregates campaign stats for the weekly recap display.
 * Schedule: Monday midnight UTC (0 0 * * 1)
 */

import { NextResponse } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";
import { AIRDROP_CONFIG } from "../../../../../lib/airdrop/config";

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Calculate week number and date range (Mon–Sun)
  const now = new Date();
  const campaignStart = AIRDROP_CONFIG.CAMPAIGN_START;
  const msElapsed = now.getTime() - campaignStart.getTime();
  const weekNumber = Math.floor(msElapsed / (7 * 86400000)) + 1;

  // Week boundaries: previous Monday to Sunday
  const weekEnd = new Date(now);
  weekEnd.setUTCHours(0, 0, 0, 0);
  const weekStart = new Date(weekEnd.getTime() - 7 * 86400000);

  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  // Idempotency: skip if this week already has an entry
  const { data: existing } = await supabase
    .from("pl_weekly_snapshots")
    .select("id")
    .eq("week_number", weekNumber)
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({ skipped: true, reason: `Week ${weekNumber} already recorded` });
  }

  // Aggregate stats for the past week
  const [storiesRes, buysRes, referralsRes, plEarnedRes, mcapStartRes, mcapEndRes] =
    await Promise.all([
      // New storylines created this week
      supabase
        .from("storylines")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekStartStr)
        .lt("created_at", weekEndStr),

      // Buy events (pl_points where action = 'buy')
      supabase
        .from("pl_points")
        .select("id", { count: "exact", head: true })
        .eq("action", "buy")
        .gte("created_at", weekStartStr)
        .lt("created_at", weekEndStr),

      // New referrals
      supabase
        .from("pl_referrals")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekStartStr)
        .lt("created_at", weekEndStr),

      // Total PL earned this week
      supabase
        .from("pl_points")
        .select("points")
        .gte("created_at", weekStartStr)
        .lt("created_at", weekEndStr),

      // MCap at week start (earliest price entry in the week)
      supabase
        .from("pl_daily_prices")
        .select("mcap_usd")
        .gte("recorded_at", weekStartStr)
        .lt("recorded_at", weekEndStr)
        .order("recorded_at", { ascending: true })
        .limit(1)
        .single(),

      // MCap at week end (latest price entry in the week)
      supabase
        .from("pl_daily_prices")
        .select("mcap_usd")
        .gte("recorded_at", weekStartStr)
        .lt("recorded_at", weekEndStr)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .single(),
    ]);

  const newStories = storiesRes.count ?? 0;
  const tokenBuys = buysRes.count ?? 0;
  const newReferrals = referralsRes.count ?? 0;
  const totalPlEarned = (plEarnedRes.data ?? []).reduce((sum, r) => sum + r.points, 0);
  const mcapStart = mcapStartRes.data?.mcap_usd ?? null;
  const mcapEnd = mcapEndRes.data?.mcap_usd ?? null;

  const { error } = await supabase.from("pl_weekly_snapshots").insert({
    week_number: weekNumber,
    week_start: weekStartStr,
    new_stories: newStories,
    token_buys: tokenBuys,
    new_referrals: newReferrals,
    mcap_start: mcapStart,
    mcap_end: mcapEnd,
    total_pl_earned: totalPlEarned,
  });

  if (error) {
    console.error("[airdrop-weekly] Insert failed:", error.message);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  console.info(`[airdrop-weekly] Week ${weekNumber} snapshot recorded: stories=${newStories} buys=${tokenBuys} referrals=${newReferrals} pl=${totalPlEarned}`);
  return NextResponse.json({
    recorded: true,
    weekNumber,
    weekStart: weekStartStr,
    newStories,
    tokenBuys,
    newReferrals,
    mcapStart,
    mcapEnd,
    totalPlEarned,
  });
}
