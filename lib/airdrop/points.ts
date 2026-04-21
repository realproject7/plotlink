/**
 * Airdrop points helpers (#881)
 *
 * Computes buy points with streak boost, and referral points.
 */

import { AIRDROP_CONFIG } from "./config";
import { getStreakBoost } from "./streak";

export { getStreakBoost };

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
