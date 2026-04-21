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
 * E.g. streak 45 (in 30-49 range) → drops to 30.
 *      streak 120 → drops to 100.
 *      streak 5 → drops to 0.
 */
export function dropOneTier(streak: number): number {
  // Find the current tier threshold
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (streak >= TIER_THRESHOLDS[i]) {
      // If at or above this tier, drop to this tier's threshold
      // But if already exactly at the threshold, drop to the tier below
      if (streak > TIER_THRESHOLDS[i]) {
        return TIER_THRESHOLDS[i];
      }
      // Exactly at the threshold — drop to previous tier
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
