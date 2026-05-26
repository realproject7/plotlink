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
  const { data: points } = await supabase
    .from("pl_points")
    .select("points")
    .eq("address", address)
    .eq("action", "buy")
    .gte("created_at", config.CAMPAIGN_START.toISOString())
    .lte("created_at", config.CAMPAIGN_END.toISOString());

  const buyVolume = (points ?? []).reduce((sum, r) => sum + r.points, 0);

  return NextResponse.json(
    {
      address,
      buy_volume_plot: buyVolume,
      fetched_at: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5",
        "Deprecation": "true",
        "Link": "</api/airdrop/projection>; rel=\"successor-version\"",
      },
    },
  );
}
