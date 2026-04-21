"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { formatUsdValue } from "../../../lib/usd-price";
import { EXPLORER_URL } from "../../../lib/contracts/constants";

const MERKLE_CLAIM_ADDRESS = (process.env.NEXT_PUBLIC_MERKLE_CLAIM_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;

const MERKLE_CLAIM_ABI = [
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimed",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

interface StatusDataFull {
  poolAmount: number;
  milestones: {
    bronze: { mcap: number; pct: number; reached: boolean };
    silver: { mcap: number; pct: number; reached: boolean };
    gold: { mcap: number; pct: number; reached: boolean };
  };
  latestPriceUsd: number | null;
}

const BURN_TX = process.env.NEXT_PUBLIC_BURN_TX ?? null;

function CampaignResults() {
  const { data } = useQuery<StatusDataFull>({
    queryKey: ["airdrop-status"],
    queryFn: async () => {
      const res = await fetch("/api/airdrop/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (!data) return null;

  const milestone = data.milestones.gold.reached
    ? { tier: "Gold", pct: data.milestones.gold.pct }
    : data.milestones.silver.reached
      ? { tier: "Silver", pct: data.milestones.silver.pct }
      : data.milestones.bronze.reached
        ? { tier: "Bronze", pct: data.milestones.bronze.pct }
        : { tier: "None", pct: 0 };

  const distributed = data.poolAmount * (milestone.pct / 100);
  const burned = data.poolAmount - distributed;

  return (
    <div className="border-border rounded border p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="bg-accent text-bg rounded px-2 py-0.5 text-[10px] font-bold">CAMPAIGN COMPLETE</span>
      </div>
      <div className="text-xs space-y-1">
        <div className="text-muted">
          Milestone achieved:{" "}
          <span className="text-foreground font-medium">
            {milestone.tier === "None" ? "None — full burn" : `${milestone.tier} (${milestone.pct}%)`}
          </span>
        </div>
        <div className="text-muted">
          Distributed:{" "}
          <span className="text-foreground font-medium">{distributed.toLocaleString()} PLOT</span>
        </div>
        <div className="text-muted">
          Burned:{" "}
          <span className="text-foreground font-medium">{burned.toLocaleString()} PLOT</span>
        </div>
        {BURN_TX && (
          <a
            href={`${EXPLORER_URL}/tx/${BURN_TX}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent text-xs hover:underline"
          >
            View burn transaction
          </a>
        )}
      </div>
    </div>
  );
}

interface ProofData {
  eligible: boolean;
  amount: string | null;
  proof: string[] | null;
  merkleRoot: string | null;
}

interface StatusData {
  latestPriceUsd: number | null;
}

export function ClaimPanel() {
  const { address, isConnected } = useAccount();

  return (
    <>
      <CampaignResults />
      {!isConnected || !address ? (
        <div className="border-border rounded border p-4 text-center">
          <p className="text-muted text-sm">Connect your wallet to check your claim.</p>
        </div>
      ) : (
        <ClaimPanelInner address={address} />
      )}
    </>
  );
}

function ClaimPanelInner({ address }: { address: string }) {
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  // Fetch proof from API
  const { data: proofData, isLoading } = useQuery<ProofData>({
    queryKey: ["airdrop-proof", address],
    queryFn: async () => {
      const res = await fetch(`/api/airdrop/proof?address=${address.toLowerCase()}`);
      if (!res.ok) throw new Error("Failed to fetch proof");
      return res.json();
    },
    staleTime: Infinity,
  });

  // Fetch price for USD display
  const { data: statusData } = useQuery<StatusData>({
    queryKey: ["airdrop-status"],
    queryFn: async () => {
      const res = await fetch("/api/airdrop/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    staleTime: 60_000,
  });

  // Check on-chain claimed status
  const { data: hasClaimed } = useReadContract({
    address: MERKLE_CLAIM_ADDRESS,
    abi: MERKLE_CLAIM_ABI,
    functionName: "claimed",
    args: [address as `0x${string}`],
    query: {
      enabled: !!proofData?.eligible,
    },
  });

  // Write contract for claim
  const { writeContract, isPending: isClaiming } = useWriteContract();

  // Wait for tx confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  if (isLoading || !proofData) {
    return (
      <div className="border-border rounded border p-4">
        <div className="text-muted text-sm">Checking claim eligibility...</div>
      </div>
    );
  }

  // Not eligible
  if (!proofData.eligible || !proofData.amount || !proofData.proof) {
    return (
      <div className="border-border rounded border p-4 text-center">
        <div className="text-foreground text-sm font-bold mb-1">Campaign Complete</div>
        <p className="text-muted text-xs">You did not earn any PLOT in this campaign.</p>
      </div>
    );
  }

  const amountFormatted = formatUnits(BigInt(proofData.amount), 18);
  const amountDisplay = Number(amountFormatted).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const price = statusData?.latestPriceUsd ?? null;
  const usdValue = price ? formatUsdValue(Number(amountFormatted) * price) : null;

  const alreadyClaimed = hasClaimed === true || isConfirmed;

  const handleClaim = () => {
    writeContract(
      {
        address: MERKLE_CLAIM_ADDRESS,
        abi: MERKLE_CLAIM_ABI,
        functionName: "claim",
        args: [BigInt(proofData.amount!), proofData.proof! as `0x${string}`[]],
      },
      {
        onSuccess: (hash) => setTxHash(hash),
      },
    );
  };

  return (
    <div className="border-border rounded border p-4">
      <div className="text-foreground text-sm font-bold mb-3">Claim Your PLOT</div>

      <div className="text-center space-y-2">
        <div>
          <div className="text-muted text-[10px]">You earned</div>
          <div className="text-foreground text-xl font-bold">{amountDisplay} PLOT</div>
          {usdValue && <div className="text-muted text-xs">({usdValue})</div>}
        </div>

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
            disabled={isClaiming || isConfirming}
            className="bg-accent text-bg rounded px-6 py-2 text-sm font-medium disabled:opacity-50 cursor-pointer"
          >
            {isClaiming ? "Sign transaction..." : isConfirming ? "Confirming..." : "Claim PLOT"}
          </button>
        )}
      </div>
    </div>
  );
}
