/**
 * User points breakdown (#885)
 * GET /api/airdrop/points?address=0x...
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";
import { AIRDROP_CONFIG } from "../../../../../lib/airdrop/config";
import { getStreakBoost, getNextTier } from "../../../../../lib/airdrop/streak";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const address = req.nextUrl.searchParams.get("address")?.toLowerCase();
  if (!address) {
    return NextResponse.json({ error: "Missing address param" }, { status: 400 });
  }

  // Points breakdown by action
  const { data: points } = await supabase
    .from("pl_points")
    .select("action, points")
    .eq("address", address);

  const breakdown = { buy: 0, referral: 0, write: 0, rate: 0 };
  let totalPoints = 0;
  for (const row of points ?? []) {
    const action = row.action as keyof typeof breakdown;
    if (action in breakdown) {
      breakdown[action] += row.points;
    }
    totalPoints += row.points;
  }

  // Total points across all users (for share %)
  const { data: allPoints } = await supabase
    .from("pl_points")
    .select("points");
  const globalTotal = (allPoints ?? []).reduce((sum, r) => sum + r.points, 0);
  const sharePercent = globalTotal > 0 ? (totalPoints / globalTotal) * 100 : 0;

  // Streak info
  const { data: streak } = await supabase
    .from("pl_streaks")
    .select("current_streak, last_checkin, longest_streak")
    .eq("address", address)
    .single();

  const currentStreak = streak?.current_streak ?? 0;
  const boostPercent = getStreakBoost(currentStreak) * 100;
  const nextTier = getNextTier(currentStreak);

  const todayUtc = new Date().toISOString().slice(0, 10);
  const checkedInToday = streak?.last_checkin
    ? new Date(streak.last_checkin).toISOString().slice(0, 10) === todayUtc
    : false;

  // Referral info
  const { data: referralCode } = await supabase
    .from("pl_referral_codes")
    .select("code, is_farcaster_username")
    .eq("address", address)
    .single();

  const { data: referredBy } = await supabase
    .from("pl_referrals")
    .select("referral_code")
    .eq("referred_address", address)
    .single();

  const { count: referredUsersCount } = await supabase
    .from("pl_referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_address", address);

  // Estimated airdrop per milestone tier
  const estimatedAirdrop = sharePercent > 0
    ? {
        bronze: Math.round((sharePercent / 100) * AIRDROP_CONFIG.POOL_AMOUNT * (AIRDROP_CONFIG.MILESTONES.BRONZE.pct / 100)),
        silver: Math.round((sharePercent / 100) * AIRDROP_CONFIG.POOL_AMOUNT * (AIRDROP_CONFIG.MILESTONES.SILVER.pct / 100)),
        gold: Math.round((sharePercent / 100) * AIRDROP_CONFIG.POOL_AMOUNT * (AIRDROP_CONFIG.MILESTONES.GOLD.pct / 100)),
        diamond: Math.round((sharePercent / 100) * AIRDROP_CONFIG.POOL_AMOUNT * (AIRDROP_CONFIG.MILESTONES.DIAMOND.pct / 100)),
      }
    : { bronze: 0, silver: 0, gold: 0, diamond: 0 };

  return NextResponse.json({
    address,
    totalPoints: Math.round(totalPoints * 100) / 100,
    sharePercent: Math.round(sharePercent * 100) / 100,
    breakdown: {
      buy: Math.round(breakdown.buy * 100) / 100,
      referral: Math.round(breakdown.referral * 100) / 100,
      write: Math.round(breakdown.write * 100) / 100,
      rate: Math.round(breakdown.rate * 100) / 100,
    },
    streak: {
      currentStreak,
      boostPercent,
      nextTier,
      checkedInToday,
      lastCheckin: streak?.last_checkin ?? null,
    },
    referral: {
      code: referralCode?.code ?? null,
      isFarcasterUsername: referralCode?.is_farcaster_username ?? false,
      referredBy: referredBy?.referral_code ?? null,
      referredUsersCount: referredUsersCount ?? 0,
    },
    estimatedAirdrop,
  });
}
