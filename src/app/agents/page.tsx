"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { cacheAgentById } from "../../../lib/actions";
import { ConnectWallet } from "../../components/ConnectWallet";
import { AgentRegister } from "../../components/AgentRegister";
import { AgentManage } from "../../components/AgentManage";
import { AgentBuild } from "../../components/AgentBuild";
import { AgentDashboard } from "../../components/AgentDashboard";
import { erc8004Abi } from "../../../lib/contracts/erc8004";
import { ERC8004_REGISTRY } from "../../../lib/contracts/constants";
import type { User } from "../../../lib/supabase";
import { getAgentUserFromDB } from "../../../lib/actions";

type Tab = "register" | "build" | "dashboard";

export default function AgentsPage() {
  const { isConnected, address } = useAccount();
  const [tab, setTab] = useState<Tab>("register");

  // DB-first: check if user has cached agent data
  const { data: dbUser, isLoading: dbLoading } = useQuery({
    queryKey: ["db-user-agent", address],
    queryFn: () => getAgentUserFromDB(address!),
    enabled: !!address,
  });

  const dbAgentId = dbUser?.agent_id;
  const dbIsOwner = dbAgentId != null && dbUser?.agent_owner?.toLowerCase() === address?.toLowerCase();
  const dbIsAgentWallet = dbAgentId != null && dbUser?.agent_wallet?.toLowerCase() === address?.toLowerCase();
  const dbDetected = dbAgentId != null;

  // RPC fallback: only if DB has no agent data
  const needsRpcFallback = !dbLoading && !dbDetected && !!address;

  const { data: rpcAgentId, isLoading: rpcWalletLoading } = useReadContract({
    address: ERC8004_REGISTRY,
    abi: erc8004Abi,
    functionName: "agentIdByWallet",
    args: address ? [address] : undefined,
    query: { enabled: needsRpcFallback },
  });

  const { data: rpcBalance, isLoading: rpcBalanceLoading } = useReadContract({
    address: ERC8004_REGISTRY,
    abi: erc8004Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: needsRpcFallback },
  });

  const rpcHasNft = rpcBalance !== undefined && rpcBalance > BigInt(0);
  const { data: rpcOwnedToken, isLoading: rpcTokenLoading } = useReadContract({
    address: ERC8004_REGISTRY,
    abi: erc8004Abi,
    functionName: "tokenOfOwnerByIndex",
    args: address ? [address, BigInt(0)] : undefined,
    query: { enabled: needsRpcFallback && rpcHasNft },
  });

  const rpcIsAgentWallet = rpcAgentId !== undefined && rpcAgentId > BigInt(0);
  const rpcIsOwner = rpcHasNft && rpcOwnedToken !== undefined;

  // Combine DB + RPC results
  let detectedAgentId: bigint | undefined;
  let detectedRole: "owner" | "agentWallet" | undefined;

  if (dbDetected) {
    detectedAgentId = BigInt(dbAgentId!);
    detectedRole = dbIsOwner ? "owner" : dbIsAgentWallet ? "agentWallet" : "owner";
  } else if (rpcIsOwner) {
    detectedAgentId = rpcOwnedToken;
    detectedRole = "owner";
  } else if (rpcIsAgentWallet) {
    detectedAgentId = rpcAgentId;
    detectedRole = "agentWallet";
  }

  const hasExistingAgent = detectedAgentId !== undefined && detectedRole !== undefined;
  const detectLoading = dbLoading || (needsRpcFallback && (rpcWalletLoading || rpcBalanceLoading || (rpcHasNft && rpcTokenLoading)));

  // Auto-cache: when RPC fallback detects an agent not in DB, persist it
  const cachedRef = useRef(false);
  useEffect(() => {
    if (!dbDetected && hasExistingAgent && address && detectedAgentId && !cachedRef.current) {
      cachedRef.current = true;
      cacheAgentById(address, detectedAgentId.toString()).catch(() => {});
    }
  }, [dbDetected, hasExistingAgent, address, detectedAgentId]);

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
