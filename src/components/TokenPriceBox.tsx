"use client";

import { usePlotUsdPrice } from "../hooks/usePlotUsdPrice";
import { formatUsdTokenPrice } from "../../lib/usd-price";
import { formatPrice } from "../../lib/format";
import { RESERVE_LABEL } from "../../lib/contracts/constants";

/**
 * Token price stat box: live USD as primary, PLOT as secondary.
 * Uses the same PLOT/USD source as Mint Club (via usePlotUsdPrice).
 */
export function TokenPriceBox({ pricePerToken }: { pricePerToken: number }) {
  const { data: plotUsd } = usePlotUsdPrice();
  const usdPrice = plotUsd ? pricePerToken * plotUsd : null;

  return (
    <>
      <div className="text-foreground text-sm font-bold">
        {usdPrice !== null ? formatUsdTokenPrice(usdPrice) : `${formatPrice(pricePerToken)} ${RESERVE_LABEL}`}
      </div>
      {usdPrice !== null && (
        <div className="text-muted text-[10px]">{formatPrice(pricePerToken)} {RESERVE_LABEL}</div>
      )}
    </>
  );
}
