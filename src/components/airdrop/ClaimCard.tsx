"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { EXPLORER_URL } from "../../../lib/contracts/constants";

const MERKLE_CLAIM_ADDRESS = (process.env.NEXT_PUBLIC_MERKLE_CLAIM_ADDRESS ?? "") as `0x${string}`;
const FINAL_BURN_TX = process.env.NEXT_PUBLIC_AIRDROP_FINAL_BURN_TX ?? null;

const MERKLE_CLAIM_ABI = [
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }, { name: "proof", type: "bytes32[]" }], outputs: [] },
  { type: "function", name: "claimed", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "claimDeadline", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

interface ClaimCardProps {
  mode: "normal" | "final-burn";
  finalState?: "sub_bronze" | "zero_recipient" | null;
}

export function ClaimCard({ mode, finalState }: ClaimCardProps) {
  if (mode === "final-burn") {
    return <FinalBurnCard finalState={finalState} />;
  }
  return <NormalClaimCard />;
}

function FinalBurnCard({ finalState }: { finalState?: "sub_bronze" | "zero_recipient" | null }) {
  const message = finalState === "sub_bronze"
    ? "Campaign ended below Bronze milestone. All tokens burned."
    : finalState === "zero_recipient"
      ? "No eligible recipients. All tokens burned."
      : "Campaign ended. Watch for Season 2.";

  return (
    <div className="border-border rounded border p-6 space-y-3">
      <h2 className="text-accent text-sm font-bold uppercase tracking-wider">Campaign Complete</h2>
      <p className="text-muted text-sm">{message}</p>
      {FINAL_BURN_TX && (
        <a
          href={`${EXPLORER_URL}/tx/${FINAL_BURN_TX}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent text-xs underline"
        >
          View burn transaction
        </a>
      )}
    </div>
  );
}

function NormalClaimCard() {
  const { address, isConnected } = useAccount();

  if (!isConnected || !address) {
    return (
      <div className="border-border rounded border p-6 text-center">
        <p className="text-muted text-sm">Connect your wallet to check your claim.</p>
      </div>
    );
  }

  return <ClaimCardInner address={address} />;
}

function ClaimCardInner({ address }: { address: string }) {
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: proofData, isLoading: proofLoading } = useQuery<{
    eligible: boolean;
    amount: string | null;
    proof: string[] | null;
  }>({
    queryKey: ["airdrop-proof", address],
    queryFn: async () => {
      const res = await fetch(`/api/airdrop/proof?address=${address.toLowerCase()}`);
      if (!res.ok) throw new Error("Failed to fetch proof");
      return res.json();
    },
    staleTime: Infinity,
  });

  const { data: projection } = useQuery<{
    buy_volume: number;
    qualified_refs: number;
    has_fc_bonus: boolean;
    multiplier: number;
    weighted_spend: number;
    community_total: number;
  }>({
    queryKey: ["airdrop-projection-claim", address],
    queryFn: async () => {
      const res = await fetch(`/api/airdrop/projection?address=${address.toLowerCase()}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: deadline } = useReadContract({
    address: MERKLE_CLAIM_ADDRESS || undefined,
    abi: MERKLE_CLAIM_ABI,
    functionName: "claimDeadline",
    query: { enabled: !!MERKLE_CLAIM_ADDRESS },
  });

  const { data: hasClaimed } = useReadContract({
    address: MERKLE_CLAIM_ADDRESS || undefined,
    abi: MERKLE_CLAIM_ABI,
    functionName: "claimed",
    args: [address as `0x${string}`],
    query: { enabled: !!proofData?.eligible && !!MERKLE_CLAIM_ADDRESS },
  });

  const { writeContract, isPending: isClaiming } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash ?? undefined });

  if (proofLoading) {
    return (
      <div className="border-border rounded border p-6">
        <p className="text-muted text-sm">Checking claim eligibility...</p>
      </div>
    );
  }

  if (!proofData?.eligible || !proofData.amount || !proofData.proof) {
    return (
      <div className="border-border rounded border p-6 text-center">
        <h2 className="text-accent mb-2 text-sm font-bold uppercase tracking-wider">Campaign Complete</h2>
        <p className="text-muted text-xs">You weren't eligible for this campaign.</p>
      </div>
    );
  }

  const amountFormatted = formatUnits(BigInt(proofData.amount), 18);
  const amountDisplay = Number(amountFormatted).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const alreadyClaimed = hasClaimed === true || isConfirmed;

  const deadlineTs = deadline ? Number(deadline) : null;
  const pastDeadline = deadlineTs ? now > deadlineTs : false;
  const timeLeft = deadlineTs && !pastDeadline ? deadlineTs - now : 0;
  const daysLeft = Math.floor(timeLeft / 86400);
  const hoursLeft = Math.floor((timeLeft % 86400) / 3600);

  const handleClaim = () => {
    writeContract(
      {
        address: MERKLE_CLAIM_ADDRESS as `0x${string}`,
        abi: MERKLE_CLAIM_ABI,
        functionName: "claim",
        args: [BigInt(proofData.amount!), proofData.proof! as `0x${string}`[]],
      },
      { onSuccess: (hash) => setTxHash(hash) },
    );
  };

  return (
    <div className="border-border rounded border p-6 space-y-5">
      <h2 className="text-accent text-sm font-bold uppercase tracking-wider">Claim Your PLOT</h2>

      {projection && (
        <div className="border-b border-[var(--border)] pb-4 space-y-2">
          <div className="text-muted text-[10px] uppercase tracking-wider">Breakdown</div>
          <div className="text-foreground text-xs space-y-1">
            <div>{projection.buy_volume.toLocaleString()} PLOT spent × {projection.multiplier.toFixed(1)}× multiplier</div>
            <div className="text-muted text-[10px]">
              ({projection.qualified_refs} refs{projection.has_fc_bonus ? " + FC bonus" : ""})
            </div>
            <div>= {projection.weighted_spend.toLocaleString()} weighted spend</div>
          </div>
        </div>
      )}

      <div className="text-center space-y-3">
        <div>
          <div className="text-muted text-[10px]">Your claim</div>
          <div className="text-accent text-xl font-bold">{amountDisplay} PLOT</div>
        </div>

        {deadlineTs && !pastDeadline && (
          <div className="text-muted text-[10px]">
            Claim window: {daysLeft}d {hoursLeft}h remaining
          </div>
        )}

        {pastDeadline && !alreadyClaimed && (
          <div className="text-[var(--danger)] text-xs">Claim window closed.</div>
        )}

        {alreadyClaimed ? (
          <div className="space-y-1">
            <div className="text-accent text-sm font-medium">Claimed</div>
            <a
              href={txHash ? `${EXPLORER_URL}/tx/${txHash}` : `${EXPLORER_URL}/address/${MERKLE_CLAIM_ADDRESS}#events`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent text-xs hover:underline"
            >
              {txHash ? "View transaction" : "View on explorer"}
            </a>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleClaim}
            disabled={isClaiming || isConfirming || pastDeadline}
            className="bg-accent text-background rounded px-6 py-2 text-sm font-medium disabled:opacity-50"
          >
            {isClaiming ? "Sign transaction..." : isConfirming ? "Confirming..." : pastDeadline ? "Claim Window Closed" : "Claim PLOT"}
          </button>
        )}
      </div>
    </div>
  );
}
