import { type Address, formatUnits } from "viem";
import { get24hPriceChange, getTokenTVL } from "./price";
import { STORY_FACTORY } from "./contracts/constants";
import type { Database, Storyline } from "./supabase";
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
 * - tvl: reserve balance (log-scaled, using actual token decimals)
 * - continuationRate: plots per day since creation
 */
function computeTrendScore(
  avgRating: number,
  priceChange: number | null,
  tvlRaw: bigint | null,
  tvlDecimals: number,
  plotCount: number,
  createdAt: string | null,
): number {
  // Rating signal (0-1), weight: 0.3
  const ratingSignal = avgRating / 5;

  // Price change signal (0-1), weight: 0.25
  const pc = priceChange ?? 0;
  const clampedPc = Math.max(-100, Math.min(200, pc));
  const priceSignal = (clampedPc + 100) / 300;

  // TVL signal (0-1), weight: 0.25
  let tvlSignal = 0;
  if (tvlRaw !== null && tvlRaw > BigInt(0)) {
    const tvlFloat = Number(formatUnits(tvlRaw, tvlDecimals));
    tvlSignal = Math.min(1, Math.log10(1 + tvlFloat) / 3);
  }

  // Continuation rate signal (0-1), weight: 0.2
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

/** Shared: fetch storyline candidates + batch ratings */
async function fetchCandidatesAndRatings(supabase: SupabaseClient<Database>, writerType?: number) {
  let q = supabase.from("storylines")
    .select("*")
    .eq("hidden", false)
    .eq("sunset", false)
    .neq("token_address", "")
    .eq("contract_address", STORY_FACTORY.toLowerCase());
  if (writerType !== undefined) q = q.eq("writer_type", writerType);
  const { data } = await q
    .order("block_timestamp", { ascending: false })
    .limit(50);

  const storylines = (data ?? []) as Storyline[];
  if (storylines.length === 0) return { storylines, ratingMap: new Map<number, number>() };

  // Batch: fetch all ratings for candidate storyline IDs in one query
  const storylineIds = storylines.map((sl) => sl.storyline_id);
  const { data: allRatings } = await supabase.from("ratings")
    .select("storyline_id, rating")
    .in("storyline_id", storylineIds)
    .eq("contract_address", STORY_FACTORY.toLowerCase());

  const ratingMap = new Map<number, number>();
  if (allRatings) {
    const grouped = new Map<number, number[]>();
    for (const r of allRatings) {
      const arr = grouped.get(r.storyline_id) ?? [];
      arr.push(r.rating);
      grouped.set(r.storyline_id, arr);
    }
    for (const [id, ratings] of grouped) {
      ratingMap.set(id, ratings.reduce((s, v) => s + v, 0) / ratings.length);
    }
  }

  return { storylines, ratingMap };
}

/** Shared: enrich a storyline with on-chain signals */
async function enrichWithOnChain(
  sl: Storyline,
): Promise<{ priceChange: number | null; tvlRaw: bigint | null; tvlDecimals: number }> {
  const tokenAddr = sl.token_address as Address;
  const [priceChangeResult, tvlResult] = await Promise.all([
    get24hPriceChange(tokenAddr).catch(() => null),
    getTokenTVL(tokenAddr).catch(() => null),
  ]);

  return {
    priceChange: priceChangeResult?.changePercent ?? null,
    tvlRaw: tvlResult?.tvlRaw ?? null,
    tvlDecimals: tvlResult?.decimals ?? 18,
  };
}

/**
 * Fetch trending storylines ranked by composite score.
 */
export async function getTrendingStorylines(
  supabase: SupabaseClient<Database>,
  limit = 20,
  writerType?: number,
  offset = 0,
): Promise<RankedStoryline[]> {
  const { storylines, ratingMap } = await fetchCandidatesAndRatings(supabase, writerType);
  if (storylines.length === 0) return [];

  const enriched = await Promise.all(
    storylines.map(async (sl): Promise<RankedStoryline> => {
      const avgRating = ratingMap.get(sl.storyline_id) ?? 0;
      const { priceChange, tvlRaw, tvlDecimals } = await enrichWithOnChain(sl);

      const trendScore = computeTrendScore(
        avgRating,
        priceChange,
        tvlRaw,
        tvlDecimals,
        sl.plot_count,
        sl.block_timestamp,
      );

      return { ...sl, trendScore };
    }),
  );

  enriched.sort((a, b) => b.trendScore - a.trendScore);
  return enriched.slice(offset, offset + limit);
}

/**
 * Fetch rising storylines — stories with accelerating signals.
 *
 * Computes the same 4 signals in a recent window (last 3 days) vs
 * prior window (days 3-6). TVL is point-in-time (same for both windows,
 * as historical TVL requires snapshots). Price change is inherently
 * recent (24h lookback), so prior window uses the same value as a
 * baseline denominator — acceleration comes from rating + plot signals.
 */
export async function getRisingStorylines(
  supabase: SupabaseClient<Database>,
  limit = 20,
  writerType?: number,
  offset = 0,
): Promise<RankedStoryline[]> {
  const { storylines } = await fetchCandidatesAndRatings(supabase, writerType);
  if (storylines.length === 0) return [];

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();

  // Exclude storylines younger than the prior window (6 days) — they have
  // no meaningful prior activity to compare against.
  const eligible = storylines.filter((sl) => {
    if (!sl.block_timestamp) return false;
    return new Date(sl.block_timestamp).getTime() <= new Date(sixDaysAgo).getTime();
  });
  if (eligible.length === 0) return [];

  const storylineIds = eligible.map((sl) => sl.storyline_id);

  // Batch: windowed ratings
  const { data: recentRatings } = await supabase.from("ratings")
    .select("storyline_id, rating")
    .in("storyline_id", storylineIds)
    .eq("contract_address", STORY_FACTORY.toLowerCase())
    .gte("updated_at", threeDaysAgo);

  const { data: priorRatings } = await supabase.from("ratings")
    .select("storyline_id, rating")
    .in("storyline_id", storylineIds)
    .eq("contract_address", STORY_FACTORY.toLowerCase())
    .gte("updated_at", sixDaysAgo)
    .lt("updated_at", threeDaysAgo);

  // Batch: windowed plot counts
  const { data: recentPlots } = await supabase.from("plots")
    .select("storyline_id")
    .in("storyline_id", storylineIds)
    .eq("contract_address", STORY_FACTORY.toLowerCase())
    .gte("block_timestamp", threeDaysAgo);

  const { data: priorPlots } = await supabase.from("plots")
    .select("storyline_id")
    .in("storyline_id", storylineIds)
    .eq("contract_address", STORY_FACTORY.toLowerCase())
    .gte("block_timestamp", sixDaysAgo)
    .lt("block_timestamp", threeDaysAgo);

  function avgFromRows(rows: { storyline_id: number; rating: number }[] | null, slId: number): number {
    if (!rows) return 0;
    const filtered = rows.filter((r: { storyline_id: number }) => r.storyline_id === slId);
    if (filtered.length === 0) return 0;
    return filtered.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / filtered.length;
  }

  function countFromRows(rows: { storyline_id: number }[] | null, slId: number): number {
    if (!rows) return 0;
    return rows.filter((r: { storyline_id: number }) => r.storyline_id === slId).length;
  }

  // Single parallel batch for all on-chain reads
  const onChainResults = await Promise.all(
    eligible.map((sl) => enrichWithOnChain(sl)),
  );

  const enriched = eligible.map((sl, i): RankedStoryline => {
    const { priceChange, tvlRaw, tvlDecimals } = onChainResults[i];

    // Recent window composite (all 4 signals)
    const recentAvgRating = avgFromRows(recentRatings, sl.storyline_id);
    const recentPlotCount = countFromRows(recentPlots, sl.storyline_id);
    const recentScore = computeTrendScore(
      recentAvgRating,
      priceChange,
      tvlRaw,
      tvlDecimals,
      recentPlotCount,
      threeDaysAgo,
    );

    // Prior window composite (same 4 signals, same TVL + price as baseline)
    const priorAvgRating = avgFromRows(priorRatings, sl.storyline_id);
    const priorPlotCount = countFromRows(priorPlots, sl.storyline_id);
    const priorScore = computeTrendScore(
      priorAvgRating,
      priceChange, // same baseline — acceleration from rating/plot signals
      tvlRaw,      // point-in-time, same for both windows
      tvlDecimals,
      priorPlotCount,
      sixDaysAgo,
    );

    // Require minimum prior activity (at least 1 rating or 1 plot in prior window)
    const hasPriorActivity = priorAvgRating > 0 || priorPlotCount > 0;
    if (!hasPriorActivity) {
      return { ...sl, trendScore: 0 };
    }

    // Rise = recent / prior (acceleration ratio)
    const trendScore = recentScore / (priorScore + 0.01);

    return { ...sl, trendScore };
  });

  enriched.sort((a, b) => b.trendScore - a.trendScore);
  return enriched.filter((s) => s.trendScore > 1).slice(offset, offset + limit);
}
