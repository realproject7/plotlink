"use client";

import { useQuery } from "@tanstack/react-query";

interface StatusData {
  campaignStart: string;
  campaignEnd: string;
  timeRemainingDays: number;
  timeElapsedPercent: number;
  poolAmount: number;
  currentFdv: number;
  milestones: {
    bronze: { mcap: number; reached: boolean };
    silver: { mcap: number; reached: boolean };
    gold: { mcap: number; reached: boolean };
    diamond: { mcap: number; reached: boolean };
  };
  activation_count: number;
  eligible_activation_count: number;
}

function formatMcap(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function nextMilestone(milestones: StatusData["milestones"]): string {
  if (!milestones.bronze.reached) return `Bronze (${formatMcap(milestones.bronze.mcap)})`;
  if (!milestones.silver.reached) return `Silver (${formatMcap(milestones.silver.mcap)})`;
  if (!milestones.gold.reached) return `Gold (${formatMcap(milestones.gold.mcap)})`;
  if (!milestones.diamond.reached) return `Diamond (${formatMcap(milestones.diamond.mcap)})`;
  return "Diamond reached";
}

export function CampaignHero() {
  const { data } = useQuery<StatusData>({
    queryKey: ["airdrop-status"],
    queryFn: async () => {
      const res = await fetch("/api/airdrop/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (!data) {
    return (
      <div className="border-border rounded border px-4 py-3">
        <div className="text-muted text-xs">Loading campaign status...</div>
      </div>
    );
  }

  const dayNum = Math.ceil(data.timeElapsedPercent / 100 * 90) || 1;

  return (
    <div className="border-border rounded border px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="text-accent font-bold uppercase tracking-wider">Buy-Back Sprint</span>
        <span className="text-muted">Day {dayNum}/90</span>
        <span className="text-foreground">FDV {formatMcap(data.currentFdv)}</span>
        <span className="text-muted">Next: {nextMilestone(data.milestones)}</span>
        {data.activation_count > 0 && (
          <span className="text-muted">{data.activation_count.toLocaleString()} activated</span>
        )}
        <span className="text-muted ml-auto">{data.timeRemainingDays}d left</span>
      </div>
    </div>
  );
}
