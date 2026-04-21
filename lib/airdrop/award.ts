/**
 * Airdrop point award helpers (#884)
 *
 * Convenience functions for awarding write and rate points,
 * called from indexer/backfill/rating endpoints.
 */

import { AIRDROP_CONFIG } from "./config";
import { getStreakBoost } from "./streak";
import { createServiceRoleClient } from "../supabase";

/**
 * Award write points (50 PL) for publishing a storyline.
 * Idempotent via metadata.storyline_id dedup.
 */
export async function awardWritePoints(
  writerAddress: string,
  storylineId: number,
  timestamp?: Date,
): Promise<void> {
  const now = timestamp ?? new Date();
  if (now < AIRDROP_CONFIG.CAMPAIGN_START || now > AIRDROP_CONFIG.CAMPAIGN_END) return;

  const supabase = createServiceRoleClient();
  if (!supabase) return;

  const address = writerAddress.toLowerCase();

  // Dedup check
  const { data: existing } = await supabase
    .from("pl_points")
    .select("id")
    .eq("action", "write")
    .eq("address", address)
    .eq("metadata->>storyline_id", String(storylineId))
    .limit(1);

  if (existing && existing.length > 0) return;

  // Look up streak
  const { data: streak } = await supabase
    .from("pl_streaks")
    .select("current_streak")
    .eq("address", address)
    .single();

  const boost = getStreakBoost(streak?.current_streak ?? 0);
  const points = AIRDROP_CONFIG.POINTS.WRITE_FLAT * (1 + boost);

  await supabase.from("pl_points").insert({
    address,
    action: "write",
    points,
    metadata: { storyline_id: storylineId },
  });
}

/**
 * Award rate points (5 PL) for rating a story.
 * Capped at RATE_DAILY_CAP per day per address.
 * Dedup via metadata.storyline_id + address.
 */
export async function awardRatePoints(
  raterAddress: string,
  storylineId: number,
): Promise<void> {
  const now = new Date();
  if (now < AIRDROP_CONFIG.CAMPAIGN_START || now > AIRDROP_CONFIG.CAMPAIGN_END) return;

  const supabase = createServiceRoleClient();
  if (!supabase) return;

  const address = raterAddress.toLowerCase();

  // Dedup check (one rating per story per user)
  const { data: existing } = await supabase
    .from("pl_points")
    .select("id")
    .eq("action", "rate")
    .eq("address", address)
    .eq("metadata->>storyline_id", String(storylineId))
    .limit(1);

  if (existing && existing.length > 0) return;

  // Daily cap check
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("pl_points")
    .select("id", { count: "exact", head: true })
    .eq("action", "rate")
    .eq("address", address)
    .gte("created_at", todayStart.toISOString());

  if ((count ?? 0) >= AIRDROP_CONFIG.POINTS.RATE_DAILY_CAP) return;

  // Look up streak
  const { data: streak } = await supabase
    .from("pl_streaks")
    .select("current_streak")
    .eq("address", address)
    .single();

  const boost = getStreakBoost(streak?.current_streak ?? 0);
  const points = AIRDROP_CONFIG.POINTS.RATE_FLAT * (1 + boost);

  await supabase.from("pl_points").insert({
    address,
    action: "rate",
    points,
    metadata: { storyline_id: storylineId },
  });
}
