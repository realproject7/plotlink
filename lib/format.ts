/**
 * Shared number formatting utilities for readable display.
 *
 * formatPrice       — token prices (small decimals, 4 sig digits)
 * formatSupply      — token supply / balances (large numbers, commas)
 * formatTokenAmount — bigint token amounts with tiered precision
 */

import { formatUnits } from "viem";

/** Format a token price for display. Accepts a string or number. */
export function formatPrice(value: string | number): string {
  const v = typeof value === "string" ? parseFloat(value) : value;
  if (v === 0 || isNaN(v)) return "0";
  if (v < 0.001) return "< 0.001";
  if (v < 1) return v.toFixed(4);
  return v.toFixed(2);
}

/** Format a raw bigint token amount for display with appropriate precision. */
export function formatTokenAmount(value: bigint, decimals: number): string {
  const num = Number(formatUnits(value, decimals));
  if (num === 0) return "0";
  if (num >= 1) {
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (num >= 0.001) {
    return num.toFixed(4);
  }
  if (num >= 0.000001) {
    return num.toFixed(6);
  }
  return num.toExponential(2);
}

/**
 * Format a small decimal using subscript-zero notation: $0.0₄6262
 * Counts leading zeros after the decimal and renders the count as a
 * Unicode subscript digit, followed by 4 significant digits.
 */
export function formatSubscriptPrice(v: number, prefix = "$"): string {
  const str = v.toFixed(20);
  const afterDot = str.split(".")[1];
  let leadingZeros = 0;
  for (const c of afterDot) {
    if (c === "0") leadingZeros++;
    else break;
  }
  const significant = afterDot.slice(leadingZeros, leadingZeros + 4);
  const subscriptDigit = String.fromCharCode(0x2080 + leadingZeros);
  return `${prefix}0.0${subscriptDigit}${significant}`;
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
