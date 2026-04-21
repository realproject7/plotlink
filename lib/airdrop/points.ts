/**
 * Airdrop points helpers (#881)
 *
 * Computes buy points with streak boost, and referral points.
 */

import { AIRDROP_CONFIG } from "./config";

/**
 * Look up the streak boost multiplier for a given streak length.
 * Returns the highest qualifying boost (e.g. streak=15 → 0.10 for the 14-day tier).
 */
export function getStreakBoost(currentStreak: number): number {
  const thresholds = Object.keys(AIRDROP_CONFIG.STREAK_BOOSTS)
    .map(Number)
    .sort((a, b) => b - a); // descending

  for (const threshold of thresholds) {
    if (currentStreak >= threshold) {
      return AIRDROP_CONFIG.STREAK_BOOSTS[threshold];
    }
  }
  return 0;
}

/**
 * Compute buy points for a trade.
 * Points = PLOT spent × BUY_PER_PLOT × (1 + streak boost)
 */
export function computeBuyPoints(
  plotSpent: number,
  currentStreak: number,
): number {
  const base = plotSpent * AIRDROP_CONFIG.POINTS.BUY_PER_PLOT;
  const boost = getStreakBoost(currentStreak);
  return base * (1 + boost);
}

/**
 * Compute referral points (percentage of buyer's boosted buy points).
 * Also boosted by the referrer's own streak.
 */
export function computeReferralPoints(
  buyerBoostedPoints: number,
  referrerStreak: number,
): number {
  const base = buyerBoostedPoints * (AIRDROP_CONFIG.POINTS.REFERRAL_PCT / 100);
  const boost = getStreakBoost(referrerStreak);
  return base * (1 + boost);
}
