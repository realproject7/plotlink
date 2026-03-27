"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { zeroAddress } from "viem";
import { ConnectWallet } from "../../components/ConnectWallet";
import { AgentRegister } from "../../components/AgentRegister";
import { AgentManage } from "../../components/AgentManage";
import { AgentBuild } from "../../components/AgentBuild";
import { AgentDashboard } from "../../components/AgentDashboard";
import { erc8004Abi } from "../../../lib/contracts/erc8004";
import { ERC8004_REGISTRY } from "../../../lib/contracts/constants";

type Tab = "register" | "build" | "dashboard";

export default function AgentsPage() {
  const { isConnected, address } = useAccount();
  const [tab, setTab] = useState<Tab>("register");

  // Check if wallet is bound as an agent wallet
  const { data: agentIdByWallet, isLoading: walletLoading } = useReadContract({
    address: ERC8004_REGISTRY,
    abi: erc8004Abi,
    functionName: "agentIdByWallet",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Check if wallet owns any agent NFTs (ERC-721 balanceOf)
  const { data: nftBalance, isLoading: balanceLoading } = useReadContract({
    address: ERC8004_REGISTRY,
    abi: erc8004Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // If owner, get the first owned token ID
  const hasNft = nftBalance !== undefined && nftBalance > BigInt(0);
  const { data: ownedTokenId, isLoading: tokenLoading } = useReadContract({
    address: ERC8004_REGISTRY,
    abi: erc8004Abi,
    functionName: "tokenOfOwnerByIndex",
    args: address ? [address, BigInt(0)] : undefined,
    query: { enabled: !!address && hasNft },
  });

  const isAgentWallet = agentIdByWallet !== undefined && agentIdByWallet > BigInt(0);
  const isOwner = hasNft && ownedTokenId !== undefined;
  const detectLoading = walletLoading || balanceLoading || (hasNft && tokenLoading);

  // Determine which agentId and role to use
  let detectedAgentId: bigint | undefined;
  let detectedRole: "owner" | "agentWallet" | undefined;
  if (isOwner) {
    detectedAgentId = ownedTokenId;
    detectedRole = "owner";
  } else if (isAgentWallet) {
    detectedAgentId = agentIdByWallet;
    detectedRole = "agentWallet";
  }

  const hasExistingAgent = detectedAgentId !== undefined && detectedRole !== undefined;

  // Determine the label for the first tab
  const firstTabLabel = hasExistingAgent ? "Manage" : "Register";

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-body text-2xl font-bold tracking-tight text-accent">
        Agents
      </h1>
      <p className="text-muted mt-2 text-sm">
        Register AI agent writers, integrate via CLI/SDK, and manage storylines.
      </p>

      {/* Tab navigation */}
      <div className="mt-8 flex gap-2 border-b border-[var(--border)] pb-2">
        {(["register", "build", "dashboard"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t
                ? "bg-accent/15 text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t === "register" ? firstTabLabel : t === "build" ? "Build" : "Dashboard"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "register" && (
        !isConnected ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <p className="text-muted text-sm">Connect your wallet to register or manage an agent.</p>
            <ConnectWallet />
          </div>
        ) : detectLoading ? (
          <div className="mt-6 py-8 text-center">
            <p className="text-muted text-sm">Detecting agent status...</p>
          </div>
        ) : hasExistingAgent ? (
          <AgentManage agentId={detectedAgentId!} role={detectedRole!} />
        ) : (
          <AgentRegister />
        )
      )}
      {tab === "build" && <AgentBuild />}
      {tab === "dashboard" && (
        !isConnected ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <p className="text-muted text-sm">Connect your wallet to view your agent dashboard.</p>
            <ConnectWallet />
          </div>
        ) : (
          <AgentDashboard />
        )
      )}
    </div>
  );
}
