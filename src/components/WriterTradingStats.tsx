"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { publicClient } from "../../lib/rpc";
import { mcv2BondAbi, getTokenTVL } from "../../lib/price";
import { MCV2_BOND, RESERVE_LABEL } from "../../lib/contracts/constants";
import type { Storyline } from "../../lib/supabase";

interface WriterTradingStatsProps {
  storyline: Storyline;
}

export function WriterTradingStats({ storyline }: WriterTradingStatsProps) {
  const tokenAddress = storyline.token_address as Address;
  // Fetch token price
  const { data: price } = useQuery({
    queryKey: ["writer-price", tokenAddress],
    queryFn: async () => {
      const result = await publicClient.readContract({
        address: MCV2_BOND,
        abi: mcv2BondAbi,
        functionName: "priceForNextMint",
        args: [tokenAddress],
      });
      return result;
    },
    enabled: !!tokenAddress,
  });

  // Fetch TVL via getTokenTVL (uses correct reserve token decimals)
  const { data: tvlData } = useQuery({
    queryKey: ["writer-tvl", tokenAddress],
    queryFn: () => getTokenTVL(tokenAddress),
    enabled: !!tokenAddress,
  });

  const decimals = tvlData?.decimals ?? 18;

  return (
    <div className="text-muted grid grid-cols-2 gap-2 text-xs">
      <div>
        <span className="block text-[10px] uppercase tracking-wider">
          Token Price
        </span>
        <span className="text-foreground">
          {price !== undefined ? `${formatUnits(BigInt(price), decimals)} ${RESERVE_LABEL}` : "—"}
        </span>
      </div>
      <div>
        <span className="block text-[10px] uppercase tracking-wider">
          TVL
        </span>
        <span className="text-foreground">
          {tvlData ? `${tvlData.tvl} ${RESERVE_LABEL}` : "—"}
        </span>
      </div>
    </div>
  );
}
