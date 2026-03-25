"use client";

import { usePlotUsdPrice } from "../hooks/usePlotUsdPrice";

/**
 * Inline USD price tag that converts a PLOT-denominated value to USD.
 * Renders nothing while loading or if price is unavailable.
 */
export function UsdPriceTag({ plotAmount }: { plotAmount: number }) {
  const { data: plotUsd } = usePlotUsdPrice();
  if (!plotUsd || plotAmount <= 0) return null;

  const usd = plotAmount * plotUsd;
  let formatted: string;
  if (usd < 0.01) formatted = "< $0.01";
  else if (usd < 1) formatted = `$${usd.toFixed(3)}`;
  else if (usd < 1000) formatted = `$${usd.toFixed(2)}`;
  else if (usd < 1_000_000) formatted = `$${(usd / 1000).toFixed(2)}K`;
  else formatted = `$${(usd / 1_000_000).toFixed(2)}M`;

  return <span className="ml-1 opacity-60">({formatted})</span>;
}
