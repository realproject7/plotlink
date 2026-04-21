/**
 * Streak check-in endpoint (#882)
 *
 * POST /api/airdrop/checkin
 * Body: { message: string, signature: string }
 *
 * Verifies SIWE signature, updates streak in pl_streaks.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";
import { AIRDROP_CONFIG } from "../../../../../lib/airdrop/config";
import { getStreakBoost, dropOneTier, getNextTier } from "../../../../../lib/airdrop/streak";
import { verifyWalletOwnership } from "../../../../../lib/airdrop/verify-wallet";

export async function POST(req: Request) {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  let message: string;
  let signature: `0x${string}`;
  try {
    const body = await req.json();
    message = body.message;
    signature = body.signature;
    if (!message || !signature) throw new Error("missing fields");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Verify wallet ownership via SIWE signature
  const claimedAddress = await verifyWalletOwnership(message, signature);
  if (!claimedAddress) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const now = new Date();

  // Campaign window check
  if (now < AIRDROP_CONFIG.CAMPAIGN_START || now > AIRDROP_CONFIG.CAMPAIGN_END) {
    return NextResponse.json({ error: "Campaign not active" }, { status: 400 });
  }

  // Fetch or create streak record
  const { data: existing } = await supabase
    .from("pl_streaks")
    .select("*")
    .eq("address", claimedAddress)
    .single();

  const todayUtc = now.toISOString().slice(0, 10); // YYYY-MM-DD

  if (existing?.last_checkin) {
    const lastCheckin = new Date(existing.last_checkin);
    const lastCheckinDay = lastCheckin.toISOString().slice(0, 10);

    // Reject if same calendar day (UTC)
    if (lastCheckinDay === todayUtc) {
      return NextResponse.json({
        error: "Already checked in today",
        streak: existing.current_streak,
        boostPercent: getStreakBoost(existing.current_streak) * 100,
        nextTier: getNextTier(existing.current_streak),
        checkedInToday: true,
      }, { status: 429 });
    }

    // Reject if less than 30 minutes ago
    const minutesSince = (now.getTime() - lastCheckin.getTime()) / (1000 * 60);
    if (minutesSince < AIRDROP_CONFIG.STREAK_MIN_GAP_MINUTES) {
      return NextResponse.json({
        error: `Must wait ${AIRDROP_CONFIG.STREAK_MIN_GAP_MINUTES} minutes between check-ins`,
      }, { status: 429 });
    }
  }

  let newStreak: number;

  if (!existing) {
    // First ever check-in
    newStreak = 1;
    const { error } = await supabase.from("pl_streaks").insert({
      address: claimedAddress,
      current_streak: newStreak,
      last_checkin: now.toISOString(),
      longest_streak: newStreak,
    });
    if (error) {
      console.error("[checkin] Insert failed:", error.message);
      return NextResponse.json({ error: "Check-in failed" }, { status: 500 });
    }
  } else {
    const lastCheckin = existing.last_checkin ? new Date(existing.last_checkin) : null;

    if (lastCheckin) {
      const lastDay = lastCheckin.toISOString().slice(0, 10);
      const yesterdayUtc = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

      if (lastDay === yesterdayUtc) {
        // Consecutive day — increment streak
        newStreak = existing.current_streak + 1;
      } else {
        // Missed 2+ days — drop to previous tier threshold
        newStreak = dropOneTier(existing.current_streak);
      }
    } else {
      newStreak = 1;
    }

    const longestStreak = Math.max(existing.longest_streak, newStreak);

    const { error } = await supabase
      .from("pl_streaks")
      .update({
        current_streak: newStreak,
        last_checkin: now.toISOString(),
        longest_streak: longestStreak,
      })
      .eq("address", claimedAddress);

    if (error) {
      console.error("[checkin] Update failed:", error.message);
      return NextResponse.json({ error: "Check-in failed" }, { status: 500 });
    }
  }

  return NextResponse.json({
    streak: newStreak,
    boostPercent: getStreakBoost(newStreak) * 100,
    nextTier: getNextTier(newStreak),
    checkedInToday: true,
  });
}
