import { type Address, formatUnits } from "viem";
import { get24hPriceChange, getTokenTVL } from "./price";
import type { Storyline } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

interface RankedStoryline extends Storyline {
  trendScore: number;
}

/**
 * Compute trending score for a storyline.
 *
 * Composite of 4 signals (each normalized to ~0-1 range):
 * - avgRating: average reader rating (0-5 → 0-1)
 * - priceChange24h: 24h price change % (clamped, mapped to 0-1)
 * - tvl: reserve balance (log-scaled)
 * - continuationRate: plots per day since creation
 */
function computeTrendScore(
  avgRating: number,
  priceChange: number | null,
  tvlRaw: bigint | null,
  plotCount: number,
  createdAt: string | null,
): number {
  // Rating signal (0-1), weight: 0.3
  const ratingSignal = avgRating / 5;

  // Price change signal (0-1), weight: 0.25
  // Clamp between -100% and +200%, map to 0-1
  const pc = priceChange ?? 0;
  const clampedPc = Math.max(-100, Math.min(200, pc));
  const priceSignal = (clampedPc + 100) / 300;

  // TVL signal (0-1), weight: 0.25
  // Log-scale: log(1 + tvl_in_units)
  let tvlSignal = 0;
  if (tvlRaw !== null && tvlRaw > BigInt(0)) {
    const tvlFloat = Number(formatUnits(tvlRaw, 18));
    tvlSignal = Math.min(1, Math.log10(1 + tvlFloat) / 3);
  }

  // Continuation rate signal (0-1), weight: 0.2
  // plots per day, capped at 5/day
  let contSignal = 0;
  if (createdAt && plotCount > 1) {
    const ageMs = Date.now() - new Date(createdAt).getTime();
    const ageDays = Math.max(1, ageMs / (1000 * 60 * 60 * 24));
    contSignal = Math.min(1, (plotCount / ageDays) / 5);
  }

  return (
    ratingSignal * 0.3 +
    priceSignal * 0.25 +
    tvlSignal * 0.25 +
    contSignal * 0.2
  );
}

/**
 * Fetch trending storylines ranked by composite score.
 * Fetches candidates from Supabase, enriches with on-chain data.
 */
export async function getTrendingStorylines(
  supabase: SupabaseClient,
  limit = 20,
): Promise<RankedStoryline[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("storylines") as any)
    .select("*")
    .eq("hidden", false)
    .eq("sunset", false)
    .neq("token_address", "")
    .order("block_timestamp", { ascending: false })
    .limit(50);

  const storylines = (data ?? []) as Storyline[];
  if (storylines.length === 0) return [];

  // Fetch ratings per storyline
  const ratingMap = new Map<number, number>();
  for (const sl of storylines) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rData } = await (supabase.from("ratings") as any)
      .select("rating")
      .eq("storyline_id", sl.storyline_id);
    const rows = (rData ?? []) as { rating: number }[];
    if (rows.length > 0) {
      const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
      ratingMap.set(sl.storyline_id, avg);
    }
  }

  // Enrich with on-chain data (parallel, error-tolerant)
  const enriched = await Promise.all(
    storylines.map(async (sl): Promise<RankedStoryline> => {
      const tokenAddr = sl.token_address as Address;
      const [priceChangeResult, tvlResult] = await Promise.all([
        get24hPriceChange(tokenAddr).catch(() => null),
        getTokenTVL(tokenAddr).catch(() => null),
      ]);

      const avgRating = ratingMap.get(sl.storyline_id) ?? 0;
      const priceChange = priceChangeResult?.changePercent ?? null;
      const tvlRaw = tvlResult?.tvlRaw ?? null;

      const trendScore = computeTrendScore(
        avgRating,
        priceChange,
        tvlRaw,
        sl.plot_count,
        sl.block_timestamp,
      );

      return { ...sl, trendScore };
    }),
  );

  enriched.sort((a, b) => b.trendScore - a.trendScore);
  return enriched.slice(0, limit);
}

/**
 * Fetch rising storylines — stories with accelerating activity.
 *
 * Compares recent activity (plots in last 3 days) vs prior period (days 3-6).
 * Stories with higher recent activity relative to baseline are "rising".
 * Also factors in positive 24h price change for on-chain momentum.
 */
export async function getRisingStorylines(
  supabase: SupabaseClient,
  limit = 20,
): Promise<RankedStoryline[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("storylines") as any)
    .select("*")
    .eq("hidden", false)
    .eq("sunset", false)
    .neq("token_address", "")
    .order("block_timestamp", { ascending: false })
    .limit(50);

  const storylines = (data ?? []) as Storyline[];
  if (storylines.length === 0) return [];

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();

  const enriched = await Promise.all(
    storylines.map(async (sl): Promise<RankedStoryline> => {
      // Recent plots (last 3 days)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: recentPlots } = await (supabase.from("plots") as any)
        .select("*", { count: "exact", head: true })
        .eq("storyline_id", sl.storyline_id)
        .gte("block_timestamp", threeDaysAgo);

      // Prior plots (days 3-6)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: priorPlots } = await (supabase.from("plots") as any)
        .select("*", { count: "exact", head: true })
        .eq("storyline_id", sl.storyline_id)
        .gte("block_timestamp", sixDaysAgo)
        .lt("block_timestamp", threeDaysAgo);

      const recent = recentPlots ?? 0;
      const prior = priorPlots ?? 0;

      // Acceleration: recent activity vs prior baseline
      const acceleration = recent / (prior + 1);

      // Factor in 24h price change for on-chain momentum
      const tokenAddr = sl.token_address as Address;
      const priceChangeResult = await get24hPriceChange(tokenAddr).catch(() => null);
      const priceBoost = priceChangeResult
        ? Math.max(0, priceChangeResult.changePercent) / 100
        : 0;

      const trendScore = acceleration * 0.7 + priceBoost * 0.3;

      return { ...sl, trendScore };
    }),
  );

  enriched.sort((a, b) => b.trendScore - a.trendScore);
  return enriched.filter((s) => s.trendScore > 0).slice(0, limit);
}
