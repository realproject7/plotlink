import { NextResponse } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";
import { getAirdropConfig } from "../../../../../lib/airdrop/config";

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

  const { data: activation } = await supabase
    .from("pl_activations")
    .select("address, fid, activated_at, is_blacklisted")
    .eq("address", address)
    .single();

  if (!activation || !activation.activated_at || activation.is_blacklisted) {
    return NextResponse.json(
      { error: "Wallet not activated or not eligible" },
      { status: 404, headers: { "Cache-Control": "public, max-age=30" } },
    );
  }

  const [allEligible, allBuys, allReferrals] = await Promise.all([
    supabase
      .from("pl_activations")
      .select("address, fid")
      .not("activated_at", "is", null)
      .eq("is_blacklisted", false),
    supabase
      .from("pl_points")
      .select("address, points")
      .eq("action", "buy")
      .gte("created_at", campStart)
      .lte("created_at", campEnd),
    supabase
      .from("pl_referrals")
      .select("referrer_address, referred_address"),
  ]);

  const eligibleSet = new Set(
    (allEligible.data ?? []).map((a) => a.address),
  );
  const fcSet = new Set(
    (allEligible.data ?? []).filter((a) => a.fid !== null).map((a) => a.address),
  );

  const buyMap = new Map<string, number>();
  for (const p of allBuys.data ?? []) {
    if (!eligibleSet.has(p.address)) continue;
    buyMap.set(p.address, (buyMap.get(p.address) ?? 0) + p.points);
  }

  const refCounts = new Map<string, number>();
  for (const r of allReferrals.data ?? []) {
    if (!eligibleSet.has(r.referred_address)) continue;
    const refVol = buyMap.get(r.referred_address) ?? 0;
    if (refVol < config.MIN_REFERRAL_THRESHOLD) continue;
    refCounts.set(r.referrer_address, (refCounts.get(r.referrer_address) ?? 0) + 1);
  }

  let communityTotal = 0;
  const walletData = new Map<string, { buyVol: number; qr: number; fc: number; mult: number; ws: number }>();

  for (const addr of eligibleSet) {
    const bv = buyMap.get(addr) ?? 0;
    if (bv <= 0) continue;
    const qr = refCounts.get(addr) ?? 0;
    const fc = fcSet.has(addr) ? 1 : 0;
    const mult = Math.min(
      1 + (qr + fc) * config.REFERRAL_MULTIPLIER_PER_REF,
      config.REFERRAL_MULTIPLIER_CAP,
    );
    const ws = bv * mult;
    communityTotal += ws;
    walletData.set(addr, { buyVol: bv, qr, fc, mult, ws });
  }

  const me = walletData.get(address);
  const buyVolume = me?.buyVol ?? 0;
  const qualifiedRefs = me?.qr ?? 0;
  const hasFcBonus = (me?.fc ?? 0) === 1;
  const multiplier = me?.mult ?? 1;
  const weightedSpend = me?.ws ?? 0;
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
