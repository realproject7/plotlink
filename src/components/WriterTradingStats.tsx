"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { publicClient } from "../../lib/rpc";
import { mcv2BondAbi, getTokenTVL } from "../../lib/price";
import { MCV2_BOND, IS_TESTNET } from "../../lib/contracts/constants";
import type { Storyline } from "../../lib/supabase";
import { supabase } from "../../lib/supabase";

function formatTruncated(value: bigint, decimals: number, digits = 6): string {
  const raw = formatUnits(value, decimals);
  const dot = raw.indexOf(".");
  if (dot === -1 || raw.length - dot - 1 <= digits) return raw;
  return raw.slice(0, dot + 1 + digits).replace(/0+$/, "").replace(/\.$/, "");
}

interface WriterTradingStatsProps {
  storyline: Storyline;
}

export function WriterTradingStats({ storyline }: WriterTradingStatsProps) {
  const tokenAddress = storyline.token_address as Address;
  const reserveLabel = IS_TESTNET ? "WETH" : "$PLOT";

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

  // Fetch total donations for this storyline
  const { data: donationsTotal } = useQuery({
    queryKey: ["writer-donations", storyline.storyline_id],
    queryFn: async () => {
      if (!supabase) return BigInt(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("donations") as any)
        .select("amount")
        .eq("storyline_id", storyline.storyline_id);
      if (!data) return BigInt(0);
      return (data as { amount: string }[]).reduce((sum, d) => sum + BigInt(d.amount), BigInt(0));
    },
  });

  const decimals = tvlData?.decimals;

  return (
    <div className="text-muted mt-3 grid grid-cols-3 gap-2 text-xs">
      <div>
        <span className="block text-[10px] uppercase tracking-wider">
          Donations
        </span>
        <span className="text-accent font-medium">
          {donationsTotal !== undefined && decimals !== undefined
            ? `${formatTruncated(donationsTotal, decimals)} ${reserveLabel}`
            : "—"}
        </span>
      </div>
      <div>
        <span className="block text-[10px] uppercase tracking-wider">
          Token Price
        </span>
        <span className="text-foreground">
          {price !== undefined && decimals !== undefined ? `${formatUnits(BigInt(price), decimals)} ${reserveLabel}` : "—"}
        </span>
      </div>
      <div>
        <span className="block text-[10px] uppercase tracking-wider">
          TVL
        </span>
        <span className="text-foreground">
          {tvlData ? `${tvlData.tvl} ${reserveLabel}` : "—"}
        </span>
      </div>
    </div>
  );
}
