"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUsdValue } from "../../../lib/usd-price";

interface Snapshot {
  weekNumber: number;
  weekStart: string;
  newStories: number;
  tokenBuys: number;
  newReferrals: number;
  mcapStart: number;
  mcapEnd: number;
  totalPlEarned: number;
}

interface SnapshotsData {
  snapshots: Snapshot[];
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start.getTime() + 6 * 86400000);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)}-${fmt(end)}`;
}

export function WeeklySnapshots() {
  const { data, isLoading } = useQuery<SnapshotsData>({
    queryKey: ["airdrop-snapshots"],
    queryFn: async () => {
      const res = await fetch("/api/airdrop/snapshots");
      if (!res.ok) throw new Error("Failed to fetch snapshots");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="border-border rounded border p-4">
        <div className="text-muted text-sm">Loading snapshots...</div>
      </div>
    );
  }

  if (data.snapshots.length === 0) {
    return (
      <div className="border-border rounded border p-4">
        <h3 className="text-foreground text-sm font-bold mb-2">Weekly Recaps</h3>
        <div className="text-muted text-xs">
          No weekly snapshots yet — check back after the first week!
        </div>
      </div>
    );
  }

  return (
    <div className="border-border rounded border p-4">
      <h3 className="text-foreground text-sm font-bold mb-3">Weekly Recaps</h3>

      <div className="space-y-2">
        {data.snapshots.map((snap) => {
          const mcapChange = snap.mcapEnd - snap.mcapStart;
          const mcapPct =
            snap.mcapStart > 0
              ? ((mcapChange / snap.mcapStart) * 100).toFixed(1)
              : "—";
          const mcapSign = mcapChange >= 0 ? "+" : "";

          return (
            <div
              key={snap.weekNumber}
              className="border-border rounded border px-3 py-2"
            >
              <div className="text-foreground text-xs font-bold mb-1">
                Week {snap.weekNumber} Recap{" "}
                <span className="text-muted font-normal">
                  ({formatWeekRange(snap.weekStart)})
                </span>
              </div>

              <div className="text-xs space-y-0.5">
                <div className="text-muted">
                  New stories:{" "}
                  <span className="text-foreground">{snap.newStories}</span>
                  {"  ·  "}Token buys:{" "}
                  <span className="text-foreground">{snap.tokenBuys}</span>
                </div>
                <div className="text-muted">
                  New referrals:{" "}
                  <span className="text-foreground">{snap.newReferrals}</span>
                </div>
                <div className="text-muted">
                  MCap:{" "}
                  <span className="text-foreground">
                    {formatUsdValue(snap.mcapStart)} → {formatUsdValue(snap.mcapEnd)}
                  </span>{" "}
                  <span
                    className={mcapChange >= 0 ? "text-accent" : "text-error"}
                  >
                    ({mcapSign}
                    {mcapPct}%)
                  </span>
                </div>
                <div className="text-muted">
                  PL earned:{" "}
                  <span className="text-foreground font-medium">
                    {Math.round(snap.totalPlEarned).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
