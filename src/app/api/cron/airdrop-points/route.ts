/**
 * Airdrop buy-points sync cron (#881)
 *
 * Syncs trade_history mint events → pl_points for buy + referral points.
 * Schedule: every 5 min
 */

import { NextResponse } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";
import { ZAP_PLOTLINK } from "../../../../../lib/contracts/constants";
import { AIRDROP_CONFIG } from "../../../../../lib/airdrop/config";
import { computeBuyPoints, computeReferralPoints } from "../../../../../lib/airdrop/points";

/** Fail closed in production when CRON_SECRET is unset */
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

  const now = new Date();
  if (now > AIRDROP_CONFIG.CAMPAIGN_END) {
    return NextResponse.json({ message: "Campaign ended, no points awarded" });
  }

  const zapAddress = ZAP_PLOTLINK.toLowerCase();

  // Fetch mint trades within the campaign window
  const { data: trades, error: tradesErr } = await supabase
    .from("trade_history")
    .select("id, user_address, reserve_amount, block_timestamp")
    .eq("event_type", "mint")
    .gte("block_timestamp", AIRDROP_CONFIG.CAMPAIGN_START.toISOString())
    .lte("block_timestamp", AIRDROP_CONFIG.CAMPAIGN_END.toISOString())
    .not("user_address", "is", null);

  if (tradesErr) {
    console.error("[airdrop-points] Failed to fetch trades:", tradesErr.message);
    return NextResponse.json({ error: "Failed to fetch trades" }, { status: 500 });
  }

  if (!trades || trades.length === 0) {
    return NextResponse.json({ message: "No trades to process", processed: 0 });
  }

  // Filter out ZAP_PLOTLINK self-mints
  const eligible = trades.filter(
    (t) => t.user_address && t.user_address.toLowerCase() !== zapAddress,
  );

  // Fetch existing trade_ids from pl_points to dedup
  const tradeIds = eligible.map((t) => t.id);
  const { data: existing } = await supabase
    .from("pl_points")
    .select("metadata")
    .eq("action", "buy")
    .in("metadata->>trade_id", tradeIds.map(String));

  const processedTradeIds = new Set(
    (existing ?? [])
      .map((r) => {
        const meta = r.metadata as Record<string, unknown> | null;
        return meta?.trade_id != null ? String(meta.trade_id) : null;
      })
      .filter(Boolean),
  );

  // Collect unique buyer addresses for streak lookup
  const buyerAddresses = [
    ...new Set(eligible.filter((t) => !processedTradeIds.has(String(t.id))).map((t) => t.user_address!.toLowerCase())),
  ];

  // Batch-fetch streaks
  const { data: streaks } = await supabase
    .from("pl_streaks")
    .select("address, current_streak")
    .in("address", buyerAddresses);

  const streakMap = new Map(
    (streaks ?? []).map((s) => [s.address.toLowerCase(), s.current_streak]),
  );

  // Batch-fetch referrals for buyers
  const { data: referrals } = await supabase
    .from("pl_referrals")
    .select("referred_address, referrer_address")
    .in("referred_address", buyerAddresses);

  const referralMap = new Map(
    (referrals ?? []).map((r) => [r.referred_address.toLowerCase(), r.referrer_address.toLowerCase()]),
  );

  // Collect referrer addresses for streak lookup
  const referrerAddresses = [...new Set(referralMap.values())];
  const { data: referrerStreaks } = referrerAddresses.length > 0
    ? await supabase
        .from("pl_streaks")
        .select("address, current_streak")
        .in("address", referrerAddresses)
    : { data: [] };

  const referrerStreakMap = new Map(
    (referrerStreaks ?? []).map((s) => [s.address.toLowerCase(), s.current_streak]),
  );

  let buyCount = 0;
  let referralCount = 0;
  const inserts: Array<{
    address: string;
    action: string;
    points: number;
    metadata: Record<string, unknown>;
  }> = [];

  for (const trade of eligible) {
    if (processedTradeIds.has(String(trade.id))) continue;

    const address = trade.user_address!.toLowerCase();
    const plotSpent = trade.reserve_amount;
    const buyerStreak = streakMap.get(address) ?? 0;

    // Buy points
    const buyPoints = computeBuyPoints(plotSpent, buyerStreak);
    inserts.push({
      address,
      action: "buy",
      points: buyPoints,
      metadata: { trade_id: trade.id },
    });
    buyCount++;

    // Referral points
    const referrer = referralMap.get(address);
    if (referrer) {
      const referrerStreak = referrerStreakMap.get(referrer) ?? 0;
      const refPoints = computeReferralPoints(buyPoints, referrerStreak);
      inserts.push({
        address: referrer,
        action: "referral",
        points: refPoints,
        metadata: { trade_id: trade.id, referred_address: address },
      });
      referralCount++;
    }
  }

  if (inserts.length > 0) {
    const { error: insertErr } = await supabase.from("pl_points").insert(inserts);
    if (insertErr) {
      console.error("[airdrop-points] Insert failed:", insertErr.message);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }
  }

  console.info(`[airdrop-points] Processed ${buyCount} buys, ${referralCount} referrals`);
  return NextResponse.json({
    message: "Points synced",
    processed: { buys: buyCount, referrals: referralCount },
  });
}
