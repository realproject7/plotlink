import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";
import { getAirdropConfig } from "../../../../../lib/airdrop/config";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const userAddress = req.nextUrl.searchParams.get("address")?.toLowerCase();
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10) || 20));

  const config = getAirdropConfig();

  const { data: rows, error } = await supabase.rpc("weighted_spend", {
    p_campaign_start: config.CAMPAIGN_START.toISOString(),
    p_campaign_end: config.CAMPAIGN_END.toISOString(),
    p_min_referral_threshold: config.MIN_REFERRAL_THRESHOLD,
    p_multiplier_per_ref: config.REFERRAL_MULTIPLIER_PER_REF,
    p_multiplier_cap: config.REFERRAL_MULTIPLIER_CAP,
  });

  if (error) {
    console.error("[leaderboard] weighted_spend RPC failed:", error.message);
    return NextResponse.json({ error: "Failed to compute leaderboard" }, { status: 500 });
  }

  const allRows = (rows ?? []) as Array<{
    address: string;
    weighted_spend: number;
    buy_volume: number;
    qualified_refs: number;
    has_fc_bonus: number;
    multiplier: number;
    community_total: number;
  }>;

  const sorted = [...allRows].sort((a, b) => Number(b.weighted_spend) - Number(a.weighted_spend));

  const totalParticipants = sorted.length;
  const totalPages = Math.ceil(totalParticipants / limit);
  const start = (page - 1) * limit;
  const pageSlice = sorted.slice(start, start + limit);

  const pageAddresses = pageSlice.map(r => r.address);
  const { data: users } = await supabase
    .from("pl_referral_codes")
    .select("address, code, is_farcaster_username")
    .in("address", pageAddresses);

  const usernameMap = new Map(
    (users ?? []).map((u) => [u.address.toLowerCase(), u.is_farcaster_username ? u.code : null]),
  );

  const communityTotal = Number(sorted[0]?.community_total ?? 0);

  const entries = pageSlice.map((row, i) => ({
    rank: start + i + 1,
    address: row.address,
    username: usernameMap.get(row.address) ?? null,
    weighted_spend: Number(row.weighted_spend),
    totalPoints: Number(row.weighted_spend),
    buy_volume: Number(row.buy_volume),
    multiplier: Number(row.multiplier),
    sharePercent: communityTotal > 0 ? Math.round((Number(row.weighted_spend) / communityTotal) * 10000) / 100 : 0,
  }));

  let userRank: number | null = null;
  if (userAddress) {
    const idx = sorted.findIndex(r => r.address === userAddress);
    userRank = idx >= 0 ? idx + 1 : null;
  }

  return NextResponse.json({ entries, userRank, totalParticipants, page, totalPages, limit }, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=15" },
  });
}
