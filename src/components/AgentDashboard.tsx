"use client";

import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { erc8004Abi } from "../../lib/contracts/erc8004";
import { mcv2BondAbi } from "../../lib/price";
import { ERC8004_REGISTRY, MCV2_BOND, PLOT_TOKEN } from "../../lib/contracts/constants";
import { browserClient } from "../../lib/rpc";
import { formatUnits } from "viem";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

interface AgentInfo {
  agentId: bigint;
  name: string;
  agentWallet?: string;
  source: "ows" | "direct";
}

export function AgentDashboard() {
  const { address } = useAccount();

  // Step 1: Get number of agent NFTs owned by connected wallet
  const { data: balance, isLoading: balanceLoading } = useReadContract({
    address: ERC8004_REGISTRY,
    abi: erc8004Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const agentCount = balance !== undefined ? Number(balance) : 0;

  // Step 2: Enumerate all owned agent IDs
  const tokenIndexCalls = useMemo(() => {
    if (!address || agentCount === 0) return [];
    return Array.from({ length: agentCount }, (_, i) => ({
      address: ERC8004_REGISTRY,
      abi: erc8004Abi,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [address, BigInt(i)] as const,
    }));
  }, [address, agentCount]);

  const { data: tokenResults, isLoading: tokensLoading } = useReadContracts({
    contracts: tokenIndexCalls,
    query: { enabled: tokenIndexCalls.length > 0 },
  });

  const agentIds = useMemo(() => {
    if (!tokenResults) return [];
    return tokenResults
      .filter((r) => r.status === "success" && r.result !== undefined)
      .map((r) => r.result as bigint);
  }, [tokenResults]);

  // Step 3: Fetch metadata (agentURI + getAgentWallet) for each agent
  const metadataCalls = useMemo(() => {
    if (agentIds.length === 0) return [];
    return agentIds.flatMap((id) => [
      {
        address: ERC8004_REGISTRY,
        abi: erc8004Abi,
        functionName: "agentURI" as const,
        args: [id] as const,
      },
      {
        address: ERC8004_REGISTRY,
        abi: erc8004Abi,
        functionName: "getAgentWallet" as const,
        args: [id] as const,
      },
    ]);
  }, [agentIds]);

  const { data: metadataResults, isLoading: metadataLoading } = useReadContracts({
    contracts: metadataCalls,
    query: { enabled: metadataCalls.length > 0 },
  });

  // Parse agent info from contract results
  const agents: AgentInfo[] = useMemo(() => {
    if (agentIds.length === 0 || !metadataResults) return [];
    return agentIds.map((id, i) => {
      const uriResult = metadataResults[i * 2];
      const walletResult = metadataResults[i * 2 + 1];

      let name = `Agent #${id.toString()}`;
      let source: "ows" | "direct" = "direct";
      if (uriResult?.status === "success" && uriResult.result) {
        try {
          const meta = JSON.parse(uriResult.result as string);
          if (meta.name) name = meta.name;
          if (meta.type === "ows-writer" || meta.owsWallet) source = "ows";
        } catch { /* not JSON */ }
      }

      const walletAddr = walletResult?.status === "success" ? (walletResult.result as string) : undefined;
      const agentWallet = walletAddr && walletAddr !== ZERO_ADDR ? walletAddr : undefined;

      return { agentId: id, name, agentWallet, source };
    });
  }, [agentIds, metadataResults]);

  // Also check if connected wallet itself is an agent wallet (not owner)
  const { data: selfAgentId } = useReadContract({
    address: ERC8004_REGISTRY,
    abi: erc8004Abi,
    functionName: "agentIdByWallet",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const isSelfAgent = selfAgentId !== undefined && selfAgentId > BigInt(0);
  const selfAlreadyInList = agents.some(
    (a) => a.agentWallet?.toLowerCase() === address?.toLowerCase() || a.agentId === selfAgentId,
  );

  // Fetch storylines for each agent's writer address
  // Direct agents use owner wallet implicitly; OWS agents need an explicit bound wallet
  const writerAddresses = useMemo(() => {
    const addrs: string[] = [];
    for (const agent of agents) {
      if (agent.agentWallet) {
        addrs.push(agent.agentWallet);
      } else if (agent.source === "direct" && address) {
        addrs.push(address);
      }
    }
    if (isSelfAgent && !selfAlreadyInList && address) {
      addrs.push(address);
    }
    return [...new Set(addrs.filter(Boolean))];
  }, [agents, isSelfAgent, selfAlreadyInList, address]);

  const { data: allStorylines, isLoading: storylinesLoading } = useQuery({
    queryKey: ["all-agent-storylines", writerAddresses],
    queryFn: async () => {
      const results: Record<string, Array<{ storyline_id: number; title: string; token_address: string; plot_count: number }>> = {};
      await Promise.all(
        writerAddresses.map(async (addr) => {
          try {
            const res = await fetch(`/api/storyline/by-writer?writer=${addr}&type=agent`);
            if (res.ok) results[addr.toLowerCase()] = await res.json();
            else results[addr.toLowerCase()] = [];
          } catch { results[addr.toLowerCase()] = []; }
        }),
      );
      return results;
    },
    enabled: writerAddresses.length > 0,
  });

  // Fetch royalties for each agent's writer address
  const { data: royalties } = useQuery({
    queryKey: ["agent-royalties", writerAddresses],
    queryFn: async () => {
      const results: Record<string, { unclaimed: bigint; claimed: bigint }> = {};
      await Promise.all(
        writerAddresses.map(async (addr) => {
          try {
            const [balance, claimed] = await browserClient.readContract({
              address: MCV2_BOND,
              abi: mcv2BondAbi,
              functionName: "getRoyaltyInfo",
              args: [addr as `0x${string}`, PLOT_TOKEN],
            });
            results[addr.toLowerCase()] = { unclaimed: balance as bigint, claimed: claimed as bigint };
          } catch { results[addr.toLowerCase()] = { unclaimed: BigInt(0), claimed: BigInt(0) }; }
        }),
      );
      return results;
    },
    enabled: writerAddresses.length > 0,
  });

  // Fetch PLOT token decimals dynamically
  const { data: plotDecimals } = useReadContract({
    address: PLOT_TOKEN,
    abi: [{ type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] }] as const,
    functionName: "decimals",
    query: { staleTime: Infinity },
  });
  const decimals = plotDecimals !== undefined ? Number(plotDecimals) : 18;

  const isLoading = balanceLoading || tokensLoading || metadataLoading;

  if (isLoading) {
    return (
      <div className="mt-6 py-8 text-center">
        <p className="text-muted text-sm">Loading agent status...</p>
      </div>
    );
  }

  const hasAgents = agents.length > 0 || (isSelfAgent && !selfAlreadyInList);

  if (!hasAgents) {
    return (
      <div className="mt-6 py-8 text-center">
        <p className="text-muted text-sm mb-2">You have no AI agents registered.</p>
        <p className="text-muted text-xs">
          Switch to the <span className="text-accent font-medium">Register</span> tab to register an agent or link an OWS Writer.
        </p>
      </div>
    );
  }

  // Aggregate stats
  const allAgentStorylines = Object.values(allStorylines || {}).flat();
  const totalStories = allAgentStorylines.length;
  const totalRoyalties = Object.values(royalties || {}).reduce(
    (acc, r) => ({ unclaimed: acc.unclaimed + r.unclaimed, claimed: acc.claimed + r.claimed }),
    { unclaimed: BigInt(0), claimed: BigInt(0) },
  );
  const totalEarned = totalRoyalties.unclaimed + totalRoyalties.claimed;

  // Build full agent list (owned + self-as-agent-wallet)
  const displayAgents = [...agents];
  if (isSelfAgent && !selfAlreadyInList) {
    displayAgents.push({
      agentId: selfAgentId,
      name: "This Wallet (Agent)",
      agentWallet: address,
      source: "direct",
    });
  }

  return (
    <div className="mt-6">
      {/* Aggregate stats */}
      {displayAgents.length > 1 && (
        <div className="border-accent/30 bg-accent/5 rounded border px-4 py-3 mb-6">
          <p className="text-accent text-sm font-medium">{displayAgents.length} Agents</p>
          <p className="text-muted text-xs mt-1">
            {totalStories} storyline{totalStories !== 1 ? "s" : ""} published
            {totalEarned > BigInt(0) && <> &middot; {formatUnits(totalEarned, decimals)} PLOT earned</>}
          </p>
        </div>
      )}

      {/* Agent cards */}
      <div className="space-y-6">
        {displayAgents.map((agent) => {
          // Direct agents use owner wallet; OWS agents need explicit binding
          const hasActivity = agent.agentWallet || agent.source === "direct";
          const writerAddr = agent.agentWallet || (agent.source === "direct" ? address : "") || "";
          const storylines = hasActivity ? (allStorylines?.[writerAddr.toLowerCase()] || []) : [];

          return (
            <div key={agent.agentId.toString()} className="bg-surface border-border rounded-[var(--card-radius)] border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-foreground text-sm font-medium">{agent.name}</p>
                  <span className="text-muted text-xs">#{agent.agentId.toString()}</span>
                  <span className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${
                    agent.source === "ows"
                      ? "border-accent/30 text-accent"
                      : "border-border text-muted"
                  }`}>
                    {agent.source === "ows" ? "OWS Writer" : "Direct"}
                  </span>
                </div>
                <Link
                  href={`/agents/${agent.agentId.toString()}`}
                  className="text-accent text-xs hover:underline"
                >
                  Profile
                </Link>
              </div>

              {agent.agentWallet ? (
                <p className="text-muted text-xs font-mono mb-3">
                  Wallet: {agent.agentWallet.slice(0, 6)}...{agent.agentWallet.slice(-4)}
                </p>
              ) : agent.source === "ows" ? (
                <p className="text-muted text-xs mb-3">
                  No wallet bound — complete binding in the Manage tab to see activity
                </p>
              ) : null}

              {hasActivity && (() => {
                const agentRoyalty = royalties?.[writerAddr.toLowerCase()];
                const earned = agentRoyalty ? agentRoyalty.unclaimed + agentRoyalty.claimed : BigInt(0);
                return (
                  <div className="flex gap-4 text-muted text-xs mb-2">
                    <span>{storylines.length} storyline{storylines.length !== 1 ? "s" : ""}</span>
                    {earned > BigInt(0) && <span>{formatUnits(earned, decimals)} PLOT earned</span>}
                  </div>
                );
              })()}

              {!hasActivity ? null : storylinesLoading ? (
                <p className="text-muted text-xs py-2">Loading...</p>
              ) : storylines.length === 0 ? (
                <p className="text-muted text-xs py-2">No storylines yet</p>
              ) : (
                <div className="space-y-2">
                  {storylines.map((s) => (
                    <Link
                      key={s.storyline_id}
                      href={`/story/${s.storyline_id}`}
                      className="border-border hover:border-accent flex items-center justify-between rounded border p-2 transition-colors"
                    >
                      <div>
                        <p className="text-foreground text-xs font-medium">{s.title}</p>
                        <p className="text-muted text-[10px] mt-0.5">
                          {s.plot_count} plot{s.plot_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className="text-muted text-[10px]">#{s.storyline_id}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
