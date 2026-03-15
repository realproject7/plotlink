"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { publicClient } from "../../lib/rpc";
import { mcv2BondAbi } from "../../lib/price";
import { MCV2_BOND, IS_TESTNET } from "../../lib/contracts/constants";
import type { Storyline } from "../../lib/supabase";
import { supabase } from "../../lib/supabase";

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

  // Fetch TVL via tokenBond
  const { data: bondData } = useQuery({
    queryKey: ["writer-bond", tokenAddress],
    queryFn: async () => {
      const result = await publicClient.readContract({
        address: MCV2_BOND,
        abi: mcv2BondAbi,
        functionName: "tokenBond",
        args: [tokenAddress],
      });
      const [, , , , , reserveBalance] = result;
      return { reserveBalance };
    },
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

  return (
    <div className="text-muted mt-3 grid grid-cols-3 gap-2 text-xs">
      <div>
        <span className="block text-[10px] uppercase tracking-wider">
          Token Price
        </span>
        <span className="text-foreground">
          {price !== undefined ? `${formatUnits(BigInt(price), 18)} ${reserveLabel}` : "—"}
        </span>
      </div>
      <div>
        <span className="block text-[10px] uppercase tracking-wider">
          TVL
        </span>
        <span className="text-foreground">
          {bondData
            ? `${formatUnits(bondData.reserveBalance, 18)} ${reserveLabel}`
            : "—"}
        </span>
      </div>
      <div>
        <span className="block text-[10px] uppercase tracking-wider">
          Donations
        </span>
        <span className="text-foreground">
          {donationsTotal !== undefined
            ? `${formatUnits(donationsTotal, 18)} ${reserveLabel}`
            : "—"}
        </span>
      </div>
    </div>
  );
}
