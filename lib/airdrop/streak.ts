/**
 * Streak helpers (#882)
 *
 * Boost multiplier lookup, tier drop logic, and next-tier info.
 */

import { AIRDROP_CONFIG } from "./config";

const TIER_THRESHOLDS = Object.keys(AIRDROP_CONFIG.STREAK_BOOSTS)
  .map(Number)
  .sort((a, b) => a - b); // ascending: [7, 14, 30, 50, 100]

/**
 * Look up the streak boost multiplier for a given streak length.
 * Returns the highest qualifying boost (e.g. streak=15 → 0.10 for the 14-day tier).
 */
export function getStreakBoost(currentStreak: number): number {
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (currentStreak >= TIER_THRESHOLDS[i]) {
      return AIRDROP_CONFIG.STREAK_BOOSTS[TIER_THRESHOLDS[i]];
    }
  }
  return 0;
}

/**
 * Drop one tier after a missed day. Returns the new streak value.
 * Per spec: streak drops to the previous tier's threshold.
 *   100+ → 50, 50-99 → 30, 30-49 → 14, 14-29 → 7, 7-13 → 0, 1-6 → 0
 */
export function dropOneTier(streak: number): number {
  // Find the current tier and drop to the one below it
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (streak >= TIER_THRESHOLDS[i]) {
      return i > 0 ? TIER_THRESHOLDS[i - 1] : 0;
    }
  }
  return 0;
}

/**
 * Get the next tier info, or null if already at max.
 */
export function getNextTier(
  currentStreak: number,
): { days: number; boost: number } | null {
  for (const threshold of TIER_THRESHOLDS) {
    if (currentStreak < threshold) {
      return {
        days: threshold,
        boost: AIRDROP_CONFIG.STREAK_BOOSTS[threshold],
      };
    }
  }
  return null; // already at max tier
}
