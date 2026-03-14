"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { publicClient } from "../../lib/rpc";
import { erc20Abi } from "../../lib/price";
import { IS_TESTNET } from "../../lib/contracts/constants";
import { supabase, type Donation } from "../../lib/supabase";

interface WriterTradingStatsProps {
  writerAddress: Address;
  storylineTokens: { storylineId: number; tokenAddress: Address }[];
}

interface StoryStats {
  storylineId: number;
  totalSupply: bigint;
}

export function WriterTradingStats({
  writerAddress,
  storylineTokens,
}: WriterTradingStatsProps) {
  const reserveLabel = IS_TESTNET ? "WETH" : "$PLOT";

  // Fetch total donations received
  const { data: totalDonations } = useQuery({
    queryKey: ["writer-total-donations", writerAddress],
    queryFn: async () => {
      if (!supabase) return BigInt(0);
      // Query donations for storylines owned by this writer
      const { data } = await supabase
        .from("donations")
        .select("amount")
        .returns<Pick<Donation, "amount">[]>();
      if (!data) return BigInt(0);
      return data.reduce((sum, d) => sum + BigInt(d.amount), BigInt(0));
    },
  });

  // Fetch per-story trading volume (totalSupply) and holder count
  const { data: storyStats } = useQuery({
    queryKey: ["writer-story-stats", storylineTokens.map((t) => t.tokenAddress)],
    queryFn: async () => {
      const results: StoryStats[] = [];
      for (const t of storylineTokens) {
        try {
          const supply = await publicClient.readContract({
            address: t.tokenAddress,
            abi: erc20Abi,
            functionName: "totalSupply",
          });
          results.push({ storylineId: t.storylineId, totalSupply: supply });
        } catch {
          results.push({ storylineId: t.storylineId, totalSupply: BigInt(0) });
        }
      }
      return results;
    },
    enabled: storylineTokens.length > 0,
  });

  if (storylineTokens.length === 0) return null;

  const totalVolume = (storyStats ?? []).reduce(
    (sum, s) => sum + s.totalSupply,
    BigInt(0),
  );

  return (
    <section className="border-border mt-8 rounded border px-4 py-4">
      <h2 className="text-foreground text-sm font-medium">Trading Stats</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-muted block text-[10px] uppercase tracking-wider">
            Total Donations
          </span>
          <span className="text-foreground">
            {formatUnits(totalDonations ?? BigInt(0), 18)} {reserveLabel}
          </span>
        </div>
        <div>
          <span className="text-muted block text-[10px] uppercase tracking-wider">
            Total Tokens Minted
          </span>
          <span className="text-foreground">
            {formatUnits(totalVolume, 18)}
          </span>
        </div>
      </div>

      {storyStats && storyStats.length > 0 && (
        <div className="mt-3 space-y-1">
          {storyStats
            .filter((s) => s.totalSupply > BigInt(0))
            .map((s) => (
              <div
                key={s.storylineId}
                className="text-muted flex justify-between text-[10px]"
              >
                <span>Story #{s.storylineId}</span>
                <span className="text-foreground">
                  {formatUnits(s.totalSupply, 18)} tokens minted
                </span>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
