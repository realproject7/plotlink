"use client";

import { usePlotUsdPrice } from "../hooks/usePlotUsdPrice";
import { formatUsdValue } from "../../lib/usd-price";
import { RESERVE_LABEL } from "../../lib/contracts/constants";

/**
 * Inline USD-first price display for a PLOT-denominated value.
 * Shows: "$X.XX (Y PLOT)" when USD available, "Y PLOT" when not.
 */
export function UsdPriceTag({ plotAmount }: { plotAmount: number }) {
  const { data: plotUsd } = usePlotUsdPrice();

  if (plotAmount <= 0) return <span>$0.00 (0 {RESERVE_LABEL})</span>;

  if (!plotUsd) return <span>{plotAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {RESERVE_LABEL}</span>;

  const usd = plotAmount * plotUsd;
  return (
    <span>
      <span className="font-semibold">{formatUsdValue(usd)}</span>
      <span className="ml-1 opacity-60">({plotAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {RESERVE_LABEL})</span>
    </span>
  );
}
