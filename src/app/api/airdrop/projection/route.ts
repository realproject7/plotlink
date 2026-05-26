import { NextResponse } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";
import { getAirdropConfig } from "../../../../../lib/airdrop/config";
import { computeWeightedSpend } from "../../../../../lib/airdrop/sql";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.toLowerCase();

  if (!address) {
    return NextResponse.json({ error: "address parameter required" }, { status: 400 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const config = getAirdropConfig();
  const campStart = config.CAMPAIGN_START.toISOString();
  const campEnd = config.CAMPAIGN_END.toISOString();

  const [activationsRes, buysRes, referralsRes] = await Promise.all([
    supabase.from("pl_activations").select("address, fid, activated_at, is_blacklisted"),
    supabase
      .from("pl_points")
      .select("address, action, points, created_at")
      .eq("action", "buy")
      .gte("created_at", campStart)
      .lte("created_at", campEnd),
    supabase.from("pl_referrals").select("referrer_address, referred_address"),
  ]);

  const rows = computeWeightedSpend(
    config,
    (activationsRes.data ?? []) as Parameters<typeof computeWeightedSpend>[1],
    (buysRes.data ?? []) as Parameters<typeof computeWeightedSpend>[2],
    (referralsRes.data ?? []) as Parameters<typeof computeWeightedSpend>[3],
  );

  const me = rows.find(r => r.address === address);

  if (!me) {
    const { data: activation } = await supabase
      .from("pl_activations")
      .select("activated_at, is_blacklisted")
      .eq("address", address)
      .single();

    if (!activation || !activation.activated_at || activation.is_blacklisted) {
      return NextResponse.json(
        { error: "Wallet not activated or not eligible" },
        { status: 404, headers: { "Cache-Control": "public, max-age=30" } },
      );
    }

    const pool = config.POOL_AMOUNT;
    return NextResponse.json(
      {
        address,
        buy_volume: 0,
        qualified_refs: 0,
        has_fc_bonus: false,
        multiplier: 1,
        weighted_spend: 0,
        community_total: rows[0]?.community_total ?? 0,
        projected_share: { bronze: 0, silver: 0, gold: 0, diamond: 0 },
      },
      { headers: { "Cache-Control": "public, max-age=30" } },
    );
  }

  const share = me.community_total > 0 ? me.weighted_spend / me.community_total : 0;
  const pool = config.POOL_AMOUNT;

  return NextResponse.json(
    {
      address,
      buy_volume: me.buy_volume,
      qualified_refs: me.qualified_refs,
      has_fc_bonus: me.has_fc_bonus === 1,
      multiplier: me.multiplier,
      weighted_spend: me.weighted_spend,
      community_total: me.community_total,
      projected_share: {
        bronze: pool * (config.MILESTONES.BRONZE.pct / 100) * share,
        silver: pool * (config.MILESTONES.SILVER.pct / 100) * share,
        gold: pool * (config.MILESTONES.GOLD.pct / 100) * share,
        diamond: pool * (config.MILESTONES.DIAMOND.pct / 100) * share,
      },
    },
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}
