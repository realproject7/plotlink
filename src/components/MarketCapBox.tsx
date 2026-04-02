"use client";

import { usePlotUsdPrice } from "../hooks/usePlotUsdPrice";
import { formatUsdValue } from "../../lib/usd-price";
import { useQuery } from "@tanstack/react-query";
import { get24hPriceChange } from "../../lib/price";
import { browserClient } from "../../lib/rpc";
import { type Address } from "viem";

/**
 * Client component that displays Market Cap in USD with 24h % change.
 * Market Cap = totalSupply * pricePerToken * plotUsd
 */
export function MarketCapBox({
  tokenAddress,
  totalSupply,
  pricePerToken,
}: {
  tokenAddress: string;
  totalSupply: number;
  pricePerToken: number;
}) {
  const { data: plotUsd } = usePlotUsdPrice();
  const { data: priceChange } = useQuery({
    queryKey: ["24h-change", tokenAddress],
    queryFn: () => get24hPriceChange(tokenAddress as Address, browserClient),
    staleTime: 60000,
  });

  if (!plotUsd) return null;

  const marketCapUsd = totalSupply * pricePerToken * plotUsd;
  const changePercent = priceChange?.changePercent ?? null;

  return (
    <div>
      <span className="text-muted block text-[10px] uppercase tracking-wider">
        Market Cap
      </span>
      <span className="font-semibold text-accent">
        {formatUsdValue(marketCapUsd)}
        {changePercent !== null && (
          <span className={`ml-1.5 text-[10px] font-medium ${changePercent >= 0 ? "text-accent" : "text-error"}`}>
            {changePercent >= 0 ? "+" : ""}{changePercent.toFixed(1)}%
          </span>
        )}
      </span>
    </div>
  );
}
