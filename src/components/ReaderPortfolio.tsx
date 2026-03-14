"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { publicClient } from "../../lib/rpc";
import { erc20Abi, mcv2BondAbi } from "../../lib/price";
import { MCV2_BOND, IS_TESTNET } from "../../lib/contracts/constants";
import { supabase, type Storyline } from "../../lib/supabase";

interface ReaderPortfolioProps {
  readerAddress: Address;
}

interface Holding {
  storylineId: number;
  title: string;
  balance: bigint;
  pricePerToken: bigint;
  value: bigint;
}

export function ReaderPortfolio({ readerAddress }: ReaderPortfolioProps) {
  const reserveLabel = IS_TESTNET ? "WETH" : "$PLOT";

  const { data: holdings, isLoading } = useQuery({
    queryKey: ["reader-portfolio", readerAddress],
    queryFn: async () => {
      if (!supabase) return [];

      // Fetch all storylines with token addresses
      const { data: storylines } = await supabase
        .from("storylines")
        .select("*")
        .eq("hidden", false)
        .returns<Storyline[]>();

      if (!storylines) return [];

      const withTokens = storylines.filter((s) => s.token_address);
      const results: Holding[] = [];

      // Check balance for each token
      for (const s of withTokens) {
        try {
          const balance = await publicClient.readContract({
            address: s.token_address as Address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [readerAddress],
          });

          if (balance > BigInt(0)) {
            // Get current price for value calculation
            let pricePerToken = BigInt(0);
            try {
              const oneToken = BigInt(10 ** 18);
              pricePerToken = await publicClient.readContract({
                address: MCV2_BOND,
                abi: mcv2BondAbi,
                functionName: "getReserveForToken",
                args: [s.token_address as Address, oneToken],
              });
            } catch {
              // Price unavailable
            }

            const value =
              pricePerToken > BigInt(0)
                ? (balance * pricePerToken) / BigInt(10 ** 18)
                : BigInt(0);

            results.push({
              storylineId: s.storyline_id,
              title: s.title,
              balance,
              pricePerToken,
              value,
            });
          }
        } catch {
          // Skip tokens that fail
        }
      }

      return results;
    },
  });

  const allHoldings = holdings ?? [];
  const totalValue = allHoldings.reduce((sum, h) => sum + h.value, BigInt(0));
  const bestPick =
    allHoldings.length > 0
      ? allHoldings.reduce((best, h) => (h.value > best.value ? h : best))
      : null;

  return (
    <section className="border-border mt-8 rounded border px-4 py-4">
      <h2 className="text-foreground text-sm font-medium">Portfolio</h2>

      {isLoading && (
        <p className="text-muted mt-2 text-xs">Loading holdings...</p>
      )}

      {!isLoading && allHoldings.length === 0 && (
        <p className="text-muted mt-2 text-xs italic">
          No token holdings found.
        </p>
      )}

      {allHoldings.length > 0 && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted block text-[10px] uppercase tracking-wider">
                Portfolio Value
              </span>
              <span className="text-foreground">
                {formatUnits(totalValue, 18)} {reserveLabel}
              </span>
            </div>
            {bestPick && (
              <div>
                <span className="text-muted block text-[10px] uppercase tracking-wider">
                  Best Pick
                </span>
                <span className="text-foreground">{bestPick.title}</span>
              </div>
            )}
          </div>

          <div className="mt-3 space-y-1">
            {allHoldings.map((h) => (
              <div
                key={h.storylineId}
                className="text-muted flex justify-between text-[10px]"
              >
                <span>{h.title}</span>
                <span className="text-foreground">
                  {formatUnits(h.balance, 18)} tokens
                  {h.value > BigInt(0) && (
                    <span className="text-muted ml-1">
                      ({formatUnits(h.value, 18)} {reserveLabel})
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
