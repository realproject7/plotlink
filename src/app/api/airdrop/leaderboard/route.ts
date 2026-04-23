/**
 * Points leaderboard (#885)
 * GET /api/airdrop/leaderboard?address=0x... (optional)
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const userAddress = req.nextUrl.searchParams.get("address")?.toLowerCase();

  // Aggregate points per address
  const { data: allPoints } = await supabase
    .from("pl_points")
    .select("address, points");

  if (!allPoints || allPoints.length === 0) {
    return NextResponse.json({ entries: [], userRank: null });
  }

  // Sum points by address
  const pointsByAddress = new Map<string, number>();
  let globalTotal = 0;
  for (const row of allPoints) {
    const addr = row.address.toLowerCase();
    pointsByAddress.set(addr, (pointsByAddress.get(addr) ?? 0) + row.points);
    globalTotal += row.points;
  }

  // Sort descending by points
  const sorted = [...pointsByAddress.entries()]
    .sort((a, b) => b[1] - a[1]);

  // Look up usernames for top 50
  const top50Addresses = sorted.slice(0, 50).map(([addr]) => addr);

  const { data: users } = await supabase
    .from("pl_referral_codes")
    .select("address, code, is_farcaster_username")
    .in("address", top50Addresses);

  const usernameMap = new Map(
    (users ?? []).map((u) => [u.address.toLowerCase(), u.is_farcaster_username ? u.code : null]),
  );

  const entries = sorted.slice(0, 50).map(([addr, pts], i) => ({
    rank: i + 1,
    address: addr,
    username: usernameMap.get(addr) ?? null,
    totalPoints: Math.round(pts * 100) / 100,
    sharePercent: globalTotal > 0 ? Math.round((pts / globalTotal) * 10000) / 100 : 0,
  }));

  // Find user's rank if requested and not in top 50
  let userRank: number | null = null;
  if (userAddress) {
    const idx = sorted.findIndex(([addr]) => addr === userAddress);
    userRank = idx >= 0 ? idx + 1 : null;
  }

  return NextResponse.json({ entries, userRank }, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=15" },
  });
}
