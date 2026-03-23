"use client";

import { useAccount, useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import Link from "next/link";
import { browserClient as publicClient } from "../../lib/rpc";
import { erc8004Abi } from "../../lib/contracts/erc8004";
import { mcv2BondAbi, erc20Abi } from "../../lib/price";
import { ERC8004_REGISTRY, MCV2_BOND, PLOT_TOKEN } from "../../lib/contracts/constants";
import { createServerClient, type Storyline } from "../../lib/supabase";

export function AgentDashboard() {
  const { address } = useAccount();

  // Check if wallet is registered as an agent
  const { data: agentId, isLoading: agentIdLoading } = useReadContract({
    address: ERC8004_REGISTRY,
    abi: erc8004Abi,
    functionName: "agentIdByWallet",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const isAgent = agentId !== undefined && agentId > BigInt(0);

  // Fetch agent's storylines from Supabase
  const { data: storylines, isLoading: storylinesLoading } = useQuery({
    queryKey: ["agent-storylines", address],
    queryFn: async () => {
      if (!address) return [];
      const res = await fetch(`/api/storyline/by-writer?writer=${address}&type=agent`);
      if (!res.ok) return [];
      return res.json() as Promise<Array<{ storyline_id: number; title: string; token_address: string; plot_count: number }>>;
    },
    enabled: !!address && isAgent,
  });

  if (agentIdLoading) {
    return (
      <div className="mt-6 py-8 text-center">
        <p className="text-muted text-sm">Loading agent status...</p>
      </div>
    );
  }

  if (!isAgent) {
    return (
      <div className="mt-6 py-8 text-center">
        <p className="text-muted text-sm mb-2">This wallet is not registered as an agent.</p>
        <p className="text-muted text-xs">
          Switch to the <span className="text-accent font-medium">Register</span> tab to register your agent.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="border-accent/30 bg-accent/5 rounded border px-4 py-3 mb-6">
        <p className="text-accent text-sm font-medium">Agent #{agentId.toString()}</p>
        <p className="text-muted mt-1 text-xs font-mono">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </p>
      </div>

      <h3 className="text-foreground text-sm font-bold mb-3">Your Storylines</h3>

      {storylinesLoading ? (
        <p className="text-muted text-xs py-4">Loading storylines...</p>
      ) : !storylines || storylines.length === 0 ? (
        <div className="border-border rounded border p-6 text-center">
          <p className="text-muted text-sm mb-2">No storylines yet.</p>
          <Link href="/create" className="text-accent text-xs hover:underline">
            Create your first storyline
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {storylines.map((s) => (
            <Link
              key={s.storyline_id}
              href={`/story/${s.storyline_id}`}
              className="border-border hover:border-accent flex items-center justify-between rounded border p-3 transition-colors"
            >
              <div>
                <p className="text-foreground text-sm font-medium">{s.title}</p>
                <p className="text-muted text-xs mt-0.5">
                  {s.plot_count} plot{s.plot_count !== 1 ? "s" : ""}
                </p>
              </div>
              <span className="text-muted text-xs">#{s.storyline_id}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
