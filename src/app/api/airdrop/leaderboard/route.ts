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
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10) || 20));

  // Aggregate points per address
  const { data: allPoints } = await supabase
    .from("pl_points")
    .select("address, points");

  if (!allPoints || allPoints.length === 0) {
    return NextResponse.json({ entries: [], userRank: null, totalParticipants: 0, page: 1, totalPages: 0, limit });
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

  // Paginate
  const totalParticipants = pointsByAddress.size;
  const totalPages = Math.ceil(totalParticipants / limit);
  const start = (page - 1) * limit;
  const pageSlice = sorted.slice(start, start + limit);

  // Look up usernames for current page
  const pageAddresses = pageSlice.map(([addr]) => addr);

  const { data: users } = await supabase
    .from("pl_referral_codes")
    .select("address, code, is_farcaster_username")
    .in("address", pageAddresses);

  const usernameMap = new Map(
    (users ?? []).map((u) => [u.address.toLowerCase(), u.is_farcaster_username ? u.code : null]),
  );

  const entries = pageSlice.map(([addr, pts], i) => ({
    rank: start + i + 1,
    address: addr,
    username: usernameMap.get(addr) ?? null,
    totalPoints: Math.round(pts * 100) / 100,
    sharePercent: globalTotal > 0 ? Math.round((pts / globalTotal) * 10000) / 100 : 0,
  }));

  // Find user's rank if requested
  let userRank: number | null = null;
  if (userAddress) {
    const idx = sorted.findIndex(([addr]) => addr === userAddress);
    userRank = idx >= 0 ? idx + 1 : null;
  }

  return NextResponse.json({ entries, userRank, totalParticipants, page, totalPages, limit }, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=15" },
  });
}
