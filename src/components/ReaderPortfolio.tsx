"use client";

import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { publicClient } from "../../lib/rpc";
import { erc20Abi, mcv2BondAbi, get24hPriceChange } from "../../lib/price";
import { MCV2_BOND, IS_TESTNET } from "../../lib/contracts/constants";
import { supabase, type Storyline } from "../../lib/supabase";
import Link from "next/link";

interface Holding {
  storyline: Storyline;
  balance: bigint;
  price: bigint;
  value: bigint;
  priceChange: number | null;
}

export function ReaderPortfolio() {
  const { address, isConnected } = useAccount();
  const reserveLabel = IS_TESTNET ? "WETH" : "$PLOT";

  const { data: holdings, isLoading } = useQuery({
    queryKey: ["reader-portfolio", address],
    queryFn: async (): Promise<Holding[]> => {
      if (!address || !supabase) return [];

      // Get all non-hidden storylines with token addresses
      const { data: storylines } = await supabase
        .from("storylines")
        .select("*")
        .eq("hidden", false)
        .neq("token_address", "")
        .returns<Storyline[]>();

      if (!storylines || storylines.length === 0) return [];

      // Check balance for each token (parallel)
      const results = await Promise.all(
        storylines.map(async (sl): Promise<Holding | null> => {
          const tokenAddr = sl.token_address as Address;
          try {
            const balance = await publicClient.readContract({
              address: tokenAddr,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address],
            });

            if (balance === BigInt(0)) return null;

            const [price, priceChangeResult] = await Promise.all([
              publicClient.readContract({
                address: MCV2_BOND,
                abi: mcv2BondAbi,
                functionName: "priceForNextMint",
                args: [tokenAddr],
              }),
              get24hPriceChange(tokenAddr).catch(() => null),
            ]);

            const priceBI = BigInt(price);
            const value = (balance * priceBI) / BigInt(10 ** 18);

            return {
              storyline: sl,
              balance,
              price: priceBI,
              value,
              priceChange: priceChangeResult?.changePercent ?? null,
            };
          } catch {
            return null;
          }
        }),
      );

      return results.filter((h): h is Holding => h !== null);
    },
    enabled: isConnected && !!address,
  });

  const totalValue = holdings?.reduce((sum, h) => sum + h.value, BigInt(0)) ?? BigInt(0);
  const bestPick = holdings && holdings.length > 0
    ? holdings.reduce((best, h) =>
        (h.priceChange ?? -Infinity) > (best.priceChange ?? -Infinity) ? h : best
      )
    : null;

  if (!isConnected) return null;

  return (
    <section className="border-border mt-8 rounded border px-4 py-4">
      <h2 className="text-foreground text-sm font-medium">Portfolio</h2>

      {isLoading && (
        <p className="text-muted mt-2 text-xs">Loading holdings...</p>
      )}

      {!isLoading && holdings && holdings.length === 0 && (
        <p className="text-muted mt-2 text-xs">
          No token holdings found. Buy storyline tokens to build your portfolio.
        </p>
      )}

      {holdings && holdings.length > 0 && (
        <>
          <div className="text-muted mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="block text-[10px] uppercase tracking-wider">
                Total Value
              </span>
              <span className="text-accent text-sm font-medium">
                {formatUnits(totalValue, 18)} {reserveLabel}
              </span>
            </div>
            {bestPick && bestPick.priceChange !== null && (
              <div>
                <span className="block text-[10px] uppercase tracking-wider">
                  Best Pick (24h)
                </span>
                <span className="text-foreground">
                  {bestPick.storyline.title.slice(0, 20)}
                  {bestPick.storyline.title.length > 20 ? "..." : ""}{" "}
                  <span className={bestPick.priceChange >= 0 ? "text-accent" : "text-red-400"}>
                    {bestPick.priceChange >= 0 ? "+" : ""}
                    {bestPick.priceChange.toFixed(1)}%
                  </span>
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {holdings.map((h) => (
              <div
                key={h.storyline.id}
                className="border-border flex items-center justify-between rounded border px-3 py-2 text-xs"
              >
                <div>
                  <Link
                    href={`/story/${h.storyline.storyline_id}`}
                    className="text-foreground hover:text-accent transition-colors"
                  >
                    {h.storyline.title}
                  </Link>
                  <div className="text-muted mt-0.5">
                    {formatUnits(h.balance, 18)} tokens
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-foreground">
                    {formatUnits(h.value, 18)} {reserveLabel}
                  </div>
                  {h.priceChange !== null && (
                    <div
                      className={`text-[10px] ${h.priceChange >= 0 ? "text-accent" : "text-red-400"}`}
                    >
                      {h.priceChange >= 0 ? "+" : ""}
                      {h.priceChange.toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
