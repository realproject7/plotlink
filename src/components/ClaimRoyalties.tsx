"use client";

import { useState, useCallback } from "react";
import { useWriteContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { publicClient } from "../../lib/rpc";
import { mcv2BondAbi } from "../../lib/price";
import { MCV2_BOND, IS_TESTNET } from "../../lib/contracts/constants";

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

  // Don't show if no royalties to claim
  if (unclaimed === BigInt(0) && txState === "idle") return null;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs">
        <div>
          <span className="text-muted text-[10px] uppercase tracking-wider">
            Unclaimed Royalties
          </span>
          <span className="text-foreground ml-2">
            {formatUnits(unclaimed, 18)} {reserveLabel}
          </span>
        </div>
        {eligible ? (
          <button
            onClick={txState === "done" || txState === "error" ? reset : executeClaim}
            disabled={
              (txState === "idle" && unclaimed === BigInt(0)) ||
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
        ) : (
          <span className="text-muted text-[10px]">
            Chain plot #1 to unlock
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
