"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { browserClient } from "../../lib/rpc";
import { mcv2BondAbi, getTokenTVL } from "../../lib/price";
import { MCV2_BOND, RESERVE_LABEL } from "../../lib/contracts/constants";
import { formatPrice } from "../../lib/format";
import { formatUsdValue } from "../../lib/usd-price";
import type { Storyline } from "../../lib/supabase";

interface WriterTradingStatsProps {
  storyline: Storyline;
  plotUsd?: number | null;
}

export function WriterTradingStats({ storyline, plotUsd }: WriterTradingStatsProps) {
  const tokenAddress = storyline.token_address as Address;

  // Fetch price + TVL together so they succeed/fail atomically
  const { data } = useQuery({
    queryKey: ["writer-stats", tokenAddress],
    queryFn: async () => {
      const [priceRaw, tvlData] = await Promise.all([
        browserClient.readContract({
          address: MCV2_BOND,
          abi: mcv2BondAbi,
          functionName: "priceForNextMint",
          args: [tokenAddress],
        }),
        getTokenTVL(tokenAddress, browserClient),
      ]);
      const decimals = tvlData?.decimals ?? 18;
      return {
        price: formatUnits(BigInt(priceRaw), decimals),
        tvl: tvlData?.tvl ?? formatUnits(BigInt(0), decimals),
        decimals,
      };
    },
    enabled: !!tokenAddress,
    retry: 2,
    refetchInterval: 30000,
  });

  return (
    <div className="text-muted grid grid-cols-2 gap-2 text-xs">
      <div>
        <span className="block text-[10px] uppercase tracking-wider">
          Token Price
        </span>
        <span className="font-semibold text-accent">
          {data ? `${formatPrice(data.price)} ${RESERVE_LABEL}` : "—"}
        </span>
        {data && plotUsd && (
          <span className="text-muted ml-1 text-[10px]">
            (≈ {formatUsdValue(parseFloat(data.price) * plotUsd)})
          </span>
        )}
      </div>
      <div>
        <span className="block text-[10px] uppercase tracking-wider">
          TVL
        </span>
        <span className="font-semibold text-accent">
          {data ? `${formatPrice(data.tvl)} ${RESERVE_LABEL}` : "—"}
        </span>
        {data && plotUsd && (
          <span className="text-muted ml-1 text-[10px]">
            (≈ {formatUsdValue(parseFloat(data.tvl) * plotUsd)})
          </span>
        )}
      </div>
    </div>
  );
}
