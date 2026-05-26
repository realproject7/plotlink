import { NextResponse } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";
import { getAirdropConfig } from "../../../../../lib/airdrop/config";
import type { WeightedSpendRow } from "../../../../../lib/airdrop/sql";

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

  const { data: rows, error } = await supabase.rpc("weighted_spend", {
    p_campaign_start: config.CAMPAIGN_START.toISOString(),
    p_campaign_end: config.CAMPAIGN_END.toISOString(),
    p_min_referral_threshold: config.MIN_REFERRAL_THRESHOLD,
    p_multiplier_per_ref: config.REFERRAL_MULTIPLIER_PER_REF,
    p_multiplier_cap: config.REFERRAL_MULTIPLIER_CAP,
  });

  if (error) {
    console.error("[projection] weighted_spend RPC failed:", error.message);
    return NextResponse.json({ error: "Failed to compute projection" }, { status: 500 });
  }

  const allRows = (rows ?? []) as WeightedSpendRow[];
  const me = allRows.find(r => r.address === address);

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

    return NextResponse.json(
      {
        address,
        buy_volume: 0,
        qualified_refs: 0,
        has_fc_bonus: false,
        multiplier: 1,
        weighted_spend: 0,
        community_total: Number(allRows[0]?.community_total ?? 0),
        projected_share: { bronze: 0, silver: 0, gold: 0, diamond: 0 },
      },
      { headers: { "Cache-Control": "public, max-age=30" } },
    );
  }

  const buyVolume = Number(me.buy_volume);
  const qualifiedRefs = Number(me.qualified_refs);
  const hasFcBonus = Number(me.has_fc_bonus) === 1;
  const multiplier = Number(me.multiplier);
  const weightedSpend = Number(me.weighted_spend);
  const communityTotal = Number(me.community_total);
  const share = communityTotal > 0 ? weightedSpend / communityTotal : 0;
  const pool = config.POOL_AMOUNT;

  return NextResponse.json(
    {
      address,
      buy_volume: buyVolume,
      qualified_refs: qualifiedRefs,
      has_fc_bonus: hasFcBonus,
      multiplier,
      weighted_spend: weightedSpend,
      community_total: communityTotal,
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
