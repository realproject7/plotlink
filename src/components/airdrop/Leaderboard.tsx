"use client";

import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";

interface LeaderboardEntry {
  rank: number;
  address: string;
  username: string | null;
  totalPoints: number;
  sharePercent: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  userRank: number | null;
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function Leaderboard() {
  const { address, isConnected } = useAccount();

  const { data, isLoading } = useQuery<LeaderboardData>({
    queryKey: ["airdrop-leaderboard", address],
    queryFn: async () => {
      const params = address ? `?address=${address.toLowerCase()}` : "";
      const res = await fetch(`/api/airdrop/leaderboard${params}`);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="border-border rounded border p-4">
        <div className="text-muted text-sm">Loading leaderboard...</div>
      </div>
    );
  }

  if (data.entries.length === 0) {
    return (
      <div className="border-border rounded border p-4">
        <h3 className="text-foreground text-sm font-bold mb-2">Leaderboard</h3>
        <div className="text-muted text-xs">No participants yet.</div>
      </div>
    );
  }

  const userAddr = address?.toLowerCase();
  const inTop50 = userAddr && data.entries.some((e) => e.address === userAddr);

  return (
    <div className="border-border rounded border p-4">
      <h3 className="text-foreground text-sm font-bold mb-3">Leaderboard</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted text-left">
              <th className="pb-2 pr-2 font-medium">#</th>
              <th className="pb-2 pr-2 font-medium">User</th>
              <th className="pb-2 pr-2 font-medium text-right">PL</th>
              <th className="pb-2 font-medium text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((entry) => {
              const isUser = isConnected && userAddr === entry.address;
              return (
                <tr
                  key={entry.address}
                  className={isUser ? "bg-accent/10" : ""}
                >
                  <td className="py-1 pr-2 text-muted">{entry.rank}</td>
                  <td className="py-1 pr-2 font-mono text-foreground">
                    {entry.username ?? truncateAddress(entry.address)}
                    {isUser && <span className="text-accent ml-1">(you)</span>}
                  </td>
                  <td className="py-1 pr-2 text-right text-foreground font-medium">
                    {entry.totalPoints.toLocaleString()}
                  </td>
                  <td className="py-1 text-right text-muted">
                    {entry.sharePercent}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* User's rank if outside top 50 */}
      {isConnected && !inTop50 && data.userRank && (
        <div className="border-border mt-3 border-t pt-2 text-center text-xs">
          <span className="text-muted">Your rank: </span>
          <span className="text-foreground font-medium">#{data.userRank}</span>
        </div>
      )}
    </div>
  );
}
