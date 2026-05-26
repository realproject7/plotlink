import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";
import { getAirdropConfig } from "../../../../../lib/airdrop/config";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const address = req.nextUrl.searchParams.get("address")?.toLowerCase();
  if (!address) {
    return NextResponse.json({ error: "Missing address param" }, { status: 400 });
  }

  const config = getAirdropConfig();

  const [pointsRes, allPointsRes, streakRes, referralCodeRes, referredByRes, referredCountRes] = await Promise.all([
    supabase.from("pl_points").select("action, points").eq("address", address),
    supabase.from("pl_points").select("points"),
    supabase.from("pl_streaks").select("current_streak, last_checkin, longest_streak").eq("address", address).single(),
    supabase.from("pl_referral_codes").select("code, is_farcaster_username").eq("address", address).single(),
    supabase.from("pl_referrals").select("referral_code").eq("referred_address", address).single(),
    supabase.from("pl_referrals").select("id", { count: "exact", head: true }).eq("referrer_address", address),
  ]);

  const breakdown = { buy: 0, referral: 0, write: 0, rate: 0 };
  let totalPoints = 0;
  for (const row of pointsRes.data ?? []) {
    const action = row.action as keyof typeof breakdown;
    if (action in breakdown) {
      breakdown[action] += row.points;
    }
    totalPoints += row.points;
  }

  const globalTotal = (allPointsRes.data ?? []).reduce((sum, r) => sum + r.points, 0);
  const sharePercent = globalTotal > 0 ? (totalPoints / globalTotal) * 100 : 0;

  const currentStreak = streakRes.data?.current_streak ?? 0;
  const todayUtc = new Date().toISOString().slice(0, 10);
  const checkedInToday = streakRes.data?.last_checkin
    ? new Date(streakRes.data.last_checkin).toISOString().slice(0, 10) === todayUtc
    : false;

  const estimatedAirdrop = sharePercent > 0
    ? {
        bronze: Math.round((sharePercent / 100) * config.POOL_AMOUNT * (config.MILESTONES.BRONZE.pct / 100)),
        silver: Math.round((sharePercent / 100) * config.POOL_AMOUNT * (config.MILESTONES.SILVER.pct / 100)),
        gold: Math.round((sharePercent / 100) * config.POOL_AMOUNT * (config.MILESTONES.GOLD.pct / 100)),
        diamond: Math.round((sharePercent / 100) * config.POOL_AMOUNT * (config.MILESTONES.DIAMOND.pct / 100)),
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
      boostPercent: 0,
      nextTier: null,
      checkedInToday,
      lastCheckin: streakRes.data?.last_checkin ?? null,
    },
    referral: {
      code: referralCodeRes.data?.code ?? null,
      isFarcasterUsername: referralCodeRes.data?.is_farcaster_username ?? false,
      referredBy: referredByRes.data?.referral_code ?? null,
      referredUsersCount: referredCountRes.count ?? 0,
    },
    estimatedAirdrop,
    buy_volume_plot: breakdown.buy,
    fetched_at: new Date().toISOString(),
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5",
      "Deprecation": "true",
      "Link": "</api/airdrop/projection>; rel=\"successor-version\"",
    },
  });
}
