"use client";

import { useState, useCallback } from "react";
import { useWriteContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { publicClient } from "../../lib/rpc";
import { mcv2BondAbi, getTokenTVL } from "../../lib/price";
import { MCV2_BOND, IS_TESTNET, EXPLORER_URL } from "../../lib/contracts/constants";

function formatTruncated(value: bigint, decimals: number, digits = 10): string {
  const raw = formatUnits(value, decimals);
  const dot = raw.indexOf(".");
  if (dot === -1 || raw.length - dot - 1 <= digits) return raw;
  const truncated = raw.slice(0, dot + 1 + digits).replace(/0+$/, "").replace(/\.$/, "");
  return truncated === "0" && value > BigInt(0) ? raw.slice(0, dot + 1 + digits) : truncated;
}

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

  // Fetch reserve token decimals dynamically
  const { data: tvlData } = useQuery({
    queryKey: ["claim-decimals", tokenAddress],
    queryFn: () => getTokenTVL(tokenAddress),
  });
  const decimals = tvlData?.decimals ?? 18;

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
    <div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
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
                  <li className={eligible ? "line-through opacity-60" : ""}>
                    Chain at least 2 plots ({plotCount}/2) {eligible && "\u2713"}
                  </li>
                  <li>
                    Royalties accrue when readers trade your token ({formatTruncated(unclaimed, decimals)} {reserveLabel} unclaimed)
                  </li>
                </ul>
              </div>
            )}
          </div>
          <span className={`ml-1 font-medium ${unclaimed > BigInt(0) ? "text-accent" : "text-foreground"}`}>
            {formatTruncated(unclaimed, decimals)} {reserveLabel}
          </span>
          <button
            onClick={txState === "done" || txState === "error" ? reset : executeClaim}
            disabled={
              (txState === "idle" && !canClaim) ||
              (txState !== "idle" && txState !== "done" && txState !== "error")
            }
            className="bg-accent text-background ml-2 rounded px-3 py-0.5 text-[10px] font-medium transition-opacity disabled:opacity-40"
          >
            {txState === "idle" && "Claim"}
            {txState === "confirming" && "Confirm..."}
            {txState === "pending" && "Pending..."}
            {txState === "done" && `Claimed ${formatTruncated(claimedAmount, decimals)} ${reserveLabel}`}
            {txState === "error" && "Retry"}
          </button>
        </div>
      </div>
      {!eligible && txState === "idle" && (
        <p className="text-muted mt-1 text-[10px]">
          Chain at least 2 plots to enable royalty claims ({plotCount}/2)
        </p>
      )}
      {eligible && unclaimed === BigInt(0) && txState === "idle" && (
        <p className="text-muted mt-1 text-[10px]">
          No royalties yet — royalties accrue when readers trade your token
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
