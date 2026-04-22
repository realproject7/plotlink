/**
 * Daily FDV history for the campaign timeline chart (#936)
 * GET /api/airdrop/daily-prices — no auth required
 *
 * Returns array of { date, fdv } ordered by date ascending.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";

export async function GET() {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("pl_daily_prices")
    .select("recorded_at, mcap_usd")
    .order("recorded_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const points = (data ?? []).map((row) => ({
    date: row.recorded_at,
    fdv: Number(row.mcap_usd),
  }));

  return NextResponse.json(points, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
  });
}
