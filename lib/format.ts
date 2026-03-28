/**
 * Shared number formatting utilities for readable display.
 *
 * formatPrice  — token prices (small decimals, 4 sig digits)
 * formatSupply — token supply / balances (large numbers, commas)
 */

/** Format a token price for display. Accepts a string or number. */
export function formatPrice(value: string | number): string {
  const v = typeof value === "string" ? parseFloat(value) : value;
  if (v === 0 || isNaN(v)) return "0";
  if (v < 0.001) return "< 0.001";
  if (v < 1) return v.toFixed(4);
  return v.toFixed(2);
}

/** Format a token supply or balance for display. Accepts a string or number. */
export function formatSupply(value: string | number): string {
  const v = typeof value === "string" ? parseFloat(value) : value;
  if (v === 0 || isNaN(v)) return "0";
  if (v < 1) return v.toFixed(4);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return Math.round(v).toLocaleString("en-US");
  return v.toFixed(2);
}
