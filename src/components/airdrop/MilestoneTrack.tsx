"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUsdValue } from "../../../lib/usd-price";

interface StatusData {
  poolAmount: number;
  currentMcap: number;
  latestPriceUsd: number | null;
  milestones: {
    bronze: { mcap: number; pct: number; reached: boolean };
    silver: { mcap: number; pct: number; reached: boolean };
    gold: { mcap: number; pct: number; reached: boolean };
  };
}

const TIERS = [
  { key: "bronze" as const, label: "Bronze", color: "text-[#cd7f32]" },
  { key: "silver" as const, label: "Silver", color: "text-[#c0c0c0]" },
  { key: "gold" as const, label: "Gold", color: "text-[#ffd700]" },
];

export function MilestoneTrack() {
  const { data, isLoading } = useQuery<StatusData>({
    queryKey: ["airdrop-status"],
    queryFn: async () => {
      const res = await fetch("/api/airdrop/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="border-border rounded border p-4">
        <div className="text-muted text-sm">Loading milestones...</div>
      </div>
    );
  }

  // Progress across all three tiers (0–100 mapped to full track)
  const goldMcap = data.milestones.gold.mcap;
  const overallProgress = Math.min(100, (data.currentMcap / goldMcap) * 100);

  return (
    <div className="border-border rounded border p-4">
      <h3 className="text-foreground text-sm font-bold mb-4">Milestone Progress</h3>

      {/* Track bar */}
      <div className="relative mb-6">
        <div className="bg-surface border-border h-3 rounded-full border overflow-hidden">
          <div
            className="bg-accent h-full rounded-full transition-all"
            style={{ width: `${overallProgress}%` }}
          />
        </div>

        {/* Milestone markers */}
        {TIERS.map((tier) => {
          const milestone = data.milestones[tier.key];
          const position = (milestone.mcap / goldMcap) * 100;
          return (
            <div
              key={tier.key}
              className="absolute top-0 -translate-x-1/2"
              style={{ left: `${position}%` }}
            >
              <div
                className={`w-3 h-3 rounded-full border-2 ${
                  milestone.reached
                    ? "bg-accent border-accent"
                    : "bg-surface border-border"
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Tier details */}
      <div className="grid grid-cols-3 gap-2">
        {TIERS.map((tier) => {
          const milestone = data.milestones[tier.key];
          const poolValue = data.poolAmount * (milestone.pct / 100);
          return (
            <div
              key={tier.key}
              className={`border-border rounded border px-2 py-2 text-center ${
                milestone.reached ? "border-accent" : ""
              }`}
            >
              <div className={`text-xs font-bold ${tier.color}`}>
                {tier.label}
                {milestone.reached && " \u2713"}
              </div>
              <div className="text-foreground text-sm font-bold mt-1">
                {formatUsdValue(milestone.mcap)}
              </div>
              <div className="text-muted text-[9px]">MCap target</div>
              <div className="text-foreground text-xs font-medium mt-1">
                {milestone.pct}% &middot; {poolValue.toLocaleString()} PLOT
              </div>
              {data.latestPriceUsd != null && data.latestPriceUsd > 0 && (
                <div className="text-accent text-[10px] font-medium mt-0.5">
                  Pool: {formatUsdValue(poolValue * data.latestPriceUsd)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Current position label */}
      <div className="text-center mt-3">
        <span className="text-muted text-[10px]">
          Current: {formatUsdValue(data.currentMcap)} / {formatUsdValue(goldMcap)}
        </span>
      </div>
    </div>
  );
}
