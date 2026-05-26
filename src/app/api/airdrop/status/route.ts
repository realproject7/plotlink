import { NextResponse } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";
import { getAirdropConfig } from "../../../../../lib/airdrop/config";
import { getPlotUsdPrice } from "../../../../../lib/usd-price";

function checkEnvConfig(): boolean {
  const secrets = [
    process.env.TWITTERAPI_IO_KEY,
    process.env.NEYNAR_API_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.CRON_SECRET,
  ];
  if (secrets.some(s => !s)) return false;

  const config = getAirdropConfig();
  if (!config.SIWE_DOMAIN || !config.SIWE_URI || !config.SIWE_STATEMENT) return false;
  if (!config.SIWE_CHAIN_ID || !config.PLOTLINK_X_HANDLE) return false;
  if (!config.PLOTLINK_FC_FID) return false;
  if (config.POOL_AMOUNT <= 0) return false;
  if (config.CAMPAIGN_START >= config.CAMPAIGN_END) return false;
  if (!config.MILESTONES.BRONZE || !config.MILESTONES.SILVER || !config.MILESTONES.GOLD || !config.MILESTONES.DIAMOND) return false;

  return true;
}

export async function GET() {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const config = getAirdropConfig();
  const now = new Date();
  const start = config.CAMPAIGN_START;
  const end = config.CAMPAIGN_END;
  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = Math.max(0, now.getTime() - start.getTime());
  const remainingMs = Math.max(0, end.getTime() - now.getTime());

  const [priceRes, activationRes, eligibleRes] = await Promise.all([
    supabase
      .from("pl_daily_prices")
      .select("price_usd, mcap_usd")
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("pl_activations")
      .select("address", { count: "exact", head: true })
      .not("activated_at", "is", null),
    supabase
      .from("pl_activations")
      .select("address", { count: "exact", head: true })
      .not("activated_at", "is", null)
      .eq("is_blacklisted", false),
  ]);

  const latestPrice = priceRes.data;
  const livePriceUsd = latestPrice?.price_usd ?? (await getPlotUsdPrice());

  const MAX_SUPPLY = 1_000_000;
  const currentFdv = latestPrice?.mcap_usd
    ? Number(latestPrice.mcap_usd)
    : livePriceUsd
      ? livePriceUsd * MAX_SUPPLY
      : 0;

  const milestones = {
    bronze: {
      mcap: config.MILESTONES.BRONZE.mcap,
      pct: config.MILESTONES.BRONZE.pct,
      reached: currentFdv >= config.MILESTONES.BRONZE.mcap,
    },
    silver: {
      mcap: config.MILESTONES.SILVER.mcap,
      pct: config.MILESTONES.SILVER.pct,
      reached: currentFdv >= config.MILESTONES.SILVER.mcap,
    },
    gold: {
      mcap: config.MILESTONES.GOLD.mcap,
      pct: config.MILESTONES.GOLD.pct,
      reached: currentFdv >= config.MILESTONES.GOLD.mcap,
    },
    diamond: {
      mcap: config.MILESTONES.DIAMOND.mcap,
      pct: config.MILESTONES.DIAMOND.pct,
      reached: currentFdv >= config.MILESTONES.DIAMOND.mcap,
    },
  };

  return NextResponse.json({
    campaignStart: start.toISOString().slice(0, 10),
    campaignEnd: end.toISOString().slice(0, 10),
    timeRemainingDays: Math.ceil(remainingMs / (1000 * 60 * 60 * 24)),
    timeElapsedPercent: totalMs > 0 ? Math.min(100, Math.round((elapsedMs / totalMs) * 100)) : 0,
    poolAmount: config.POOL_AMOUNT,
    currentFdv,
    latestPriceUsd: livePriceUsd ?? null,
    milestones,
    activation_count: activationRes.count ?? 0,
    eligible_activation_count: eligibleRes.count ?? 0,
    env_check: { all_present: checkEnvConfig() },
    lockerTx: config.LOCKER_TX,
  }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
  });
}
