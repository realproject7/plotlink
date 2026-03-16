"use client";

import { useState, useCallback } from "react";
import { useWriteContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { publicClient } from "../../lib/rpc";
import { mcv2BondAbi } from "../../lib/price";
import { MCV2_BOND, IS_TESTNET, EXPLORER_URL } from "../../lib/contracts/constants";

type TxState = "idle" | "confirming" | "pending" | "done" | "error";

interface ClaimRoyaltiesProps {
  tokenAddress: Address;
  plotCount: number;
  beneficiary: Address;
}

export function ClaimRoyalties({ tokenAddress, plotCount, beneficiary }: ClaimRoyaltiesProps) {
  const [txState, setTxState] = useState<TxState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [claimedAmount, setClaimedAmount] = useState<bigint>(BigInt(0));
  const [txHash, setTxHash] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  const { writeContractAsync } = useWriteContract();

  const reserveLabel = IS_TESTNET ? "WETH" : "$PLOT";

  // Fetch unclaimed royalty balance
  const { data: royaltyInfo, refetch } = useQuery({
    queryKey: ["royalty-info", tokenAddress, beneficiary],
    queryFn: async () => {
      const unclaimed = await publicClient.readContract({
        address: MCV2_BOND,
        abi: mcv2BondAbi,
        functionName: "getRoyaltyInfo",
        args: [tokenAddress, beneficiary],
      });
      return { unclaimed };
    },
    refetchInterval: 30000,
  });

  const unclaimed = royaltyInfo?.unclaimed ?? BigInt(0);
  const eligible = plotCount >= 2;
  const canClaim = eligible && unclaimed > BigInt(0);

  const executeClaim = useCallback(async () => {
    try {
      setError(null);
      setClaimedAmount(unclaimed);
      setTxState("confirming");

      const hash = await writeContractAsync({
        address: MCV2_BOND,
        abi: mcv2BondAbi,
        functionName: "claimRoyalties",
        args: [tokenAddress],
      });
      setTxHash(hash);

      setTxState("pending");
      await publicClient.waitForTransactionReceipt({ hash });

      setTxState("done");
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
      setTxState("error");
    }
  }, [tokenAddress, unclaimed, writeContractAsync, refetch]);

  const reset = useCallback(() => {
    setTxState("idle");
    setError(null);
  }, []);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-muted text-[10px] uppercase tracking-wider">
            Royalties
          </span>
          {/* Info icon with tooltip */}
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => setShowTooltip((v) => !v)}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="text-muted hover:text-foreground text-[10px] leading-none transition-colors"
              aria-label="Royalty info"
            >
              &#9432;
            </button>
            {showTooltip && (
              <div className="border-border bg-surface absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded border px-3 py-2 text-[10px] leading-relaxed shadow-lg">
                <p className="text-foreground font-medium">Royalties</p>
                <p className="text-muted mt-1">
                  You earn a share of every trade on your storyline&apos;s token.
                </p>
                <p className="text-muted mt-1.5">To claim:</p>
                <ul className="text-muted mt-0.5 list-inside list-disc">
                  <li>
                    Chain at least 2 plots ({plotCount}/2)
                  </li>
                  <li>
                    Unclaimed &gt; 0 ({formatUnits(unclaimed, 18)} {reserveLabel})
                  </li>
                </ul>
              </div>
            )}
          </div>
          <span className="text-foreground ml-1">
            {formatUnits(unclaimed, 18)} {reserveLabel}
          </span>
        </div>
        <button
          onClick={txState === "done" || txState === "error" ? reset : executeClaim}
          disabled={
            (txState === "idle" && !canClaim) ||
            (txState !== "idle" && txState !== "done" && txState !== "error")
          }
          className="bg-accent text-background rounded px-3 py-1 text-[10px] font-medium transition-opacity disabled:opacity-40"
        >
          {txState === "idle" && "Claim"}
          {txState === "confirming" && "Confirm..."}
          {txState === "pending" && "Pending..."}
          {txState === "done" && `Claimed ${formatUnits(claimedAmount, 18)} ${reserveLabel}`}
          {txState === "error" && "Retry"}
        </button>
      </div>
      {!eligible && txState === "idle" && (
        <p className="text-muted mt-1 text-[10px]">
          Chain {2 - plotCount} more {2 - plotCount === 1 ? "plot" : "plots"} to unlock royalties
        </p>
      )}
      {txHash && txState === "done" && (
        <p className="text-muted mt-1 text-[10px]">
          Tx:{" "}
          <a
            href={`${EXPLORER_URL}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </a>
        </p>
      )}
      {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
