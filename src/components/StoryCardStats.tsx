"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address } from "viem";
import { getTokenTVL, getTokenPrice } from "../../lib/price";
import { IS_TESTNET } from "../../lib/contracts/constants";

const reserveLabel = IS_TESTNET ? "WETH" : "$PLOT";

function formatCompact(value: string): string {
  const num = parseFloat(value);
  if (num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  if (num < 1) return num.toPrecision(3);
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toFixed(2);
}

export function StoryCardStats({ tokenAddress }: { tokenAddress: string }) {
  const addr = tokenAddress as Address;

  const { data: priceInfo } = useQuery({
    queryKey: ["card-price", tokenAddress],
    queryFn: () => getTokenPrice(addr),
    staleTime: 60000,
  });

  const { data: tvlData } = useQuery({
    queryKey: ["card-tvl", tokenAddress],
    queryFn: () => getTokenTVL(addr),
    staleTime: 60000,
  });

  const price = priceInfo
    ? formatCompact(priceInfo.pricePerToken)
    : "—";
  const tvl = tvlData
    ? formatCompact(tvlData.tvl)
    : "—";

  return (
    <div className="text-muted flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
      <span>Price: <span className="text-foreground">{price} {reserveLabel}</span></span>
      <span>TVL: <span className="text-foreground">{tvl} {reserveLabel}</span></span>
    </div>
  );
}
