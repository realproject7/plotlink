"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUsdValue } from "../../../lib/usd-price";

interface StatusData {
  campaignStart: string;
  campaignEnd: string;
  timeRemainingDays: number;
  timeElapsedPercent: number;
  poolAmount: number;
  currentMcap: number;
  latestPriceUsd: number | null;
  milestones: {
    bronze: { mcap: number; pct: number; reached: boolean };
    silver: { mcap: number; pct: number; reached: boolean };
    gold: { mcap: number; pct: number; reached: boolean };
  };
  totalPointsEarned: number;
  totalParticipants: number;
  lockerId: string | null;
}

function useAirdropStatus() {
  return useQuery<StatusData>({
    queryKey: ["airdrop-status"],
    queryFn: async () => {
      const res = await fetch("/api/airdrop/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function CampaignHero() {
  const { data, isLoading } = useAirdropStatus();

  if (isLoading || !data) {
    return (
      <div className="border-border rounded border p-4">
        <div className="text-muted text-sm">Loading campaign status...</div>
      </div>
    );
  }

  // Find the next milestone target
  const nextMilestone = !data.milestones.bronze.reached
    ? { name: "Bronze", mcap: data.milestones.bronze.mcap }
    : !data.milestones.silver.reached
      ? { name: "Silver", mcap: data.milestones.silver.mcap }
      : !data.milestones.gold.reached
        ? { name: "Gold", mcap: data.milestones.gold.mcap }
        : null;

  const mcapProgress = nextMilestone
    ? Math.min(100, (data.currentMcap / nextMilestone.mcap) * 100)
    : 100;

  return (
    <div className="border-border rounded border p-4 space-y-4">
      <div>
        <h2 className="text-foreground text-lg font-bold">PLOT 10x Airdrop</h2>
        <p className="text-muted text-xs mt-1">
          {data.poolAmount.toLocaleString()} PLOT locked. Big or nothing.
        </p>
      </div>

      {/* Time progress */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted">Time remaining</span>
          <span className="text-foreground font-medium">{data.timeRemainingDays} days</span>
        </div>
        <div className="bg-surface border-border h-2 rounded border overflow-hidden">
          <div
            className="bg-accent h-full transition-all"
            style={{ width: `${data.timeElapsedPercent}%` }}
          />
        </div>
        <div className="text-muted text-[10px] mt-0.5 text-right">{data.timeElapsedPercent}% elapsed</div>
      </div>

      {/* Market Cap progress */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted">Market Cap</span>
          <span className="text-foreground font-medium">{formatUsdValue(data.currentMcap)}</span>
        </div>
        <div className="bg-surface border-border h-2 rounded border overflow-hidden">
          <div
            className="bg-accent h-full transition-all"
            style={{ width: `${mcapProgress}%` }}
          />
        </div>
        <div className="text-muted text-[10px] mt-0.5 text-right">
          {nextMilestone ? `< ${nextMilestone.name} (${formatUsdValue(nextMilestone.mcap)})` : "Gold reached"}
        </div>
      </div>

      {/* Pool value at next milestone */}
      {data.latestPriceUsd != null && data.latestPriceUsd > 0 && (
        <div className="text-center text-xs">
          {nextMilestone ? (
            <span className="text-muted">
              Pool value if {nextMilestone.name}:{" "}
              <span className="text-foreground font-medium">
                {formatUsdValue(
                  data.poolAmount *
                    (data.milestones[
                      nextMilestone.name.toLowerCase() as keyof typeof data.milestones
                    ].pct / 100) *
                    data.latestPriceUsd
                )}
              </span>
            </span>
          ) : (
            <span className="text-muted">
              Pool value at Gold:{" "}
              <span className="text-foreground font-medium">
                {formatUsdValue(
                  data.poolAmount *
                    (data.milestones.gold.pct / 100) *
                    data.latestPriceUsd
                )}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="border-border rounded border px-2 py-1.5">
          <div className="text-foreground text-sm font-bold">{data.totalParticipants}</div>
          <div className="text-muted text-[9px]">Participants</div>
        </div>
        <div className="border-border rounded border px-2 py-1.5">
          <div className="text-foreground text-sm font-bold">{Math.round(data.totalPointsEarned).toLocaleString()}</div>
          <div className="text-muted text-[9px]">PL Earned</div>
        </div>
        <div className="border-border rounded border px-2 py-1.5">
          <div className="text-foreground text-sm font-bold">
            {data.latestPriceUsd ? formatUsdValue(data.latestPriceUsd) : "—"}
          </div>
          <div className="text-muted text-[9px]">PLOT Price</div>
        </div>
      </div>

      {/* Lockup proof */}
      {data.lockerId && (
        <div className="text-center">
          <a
            href={`https://mint.club/locker/${data.lockerId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent text-xs hover:underline"
          >
            View lockup proof on-chain
          </a>
        </div>
      )}
    </div>
  );
}
