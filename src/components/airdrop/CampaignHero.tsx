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
    diamond: { mcap: number; pct: number; reached: boolean };
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

function CountdownDisplay({ days }: { days: number }) {
  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;

  return (
    <div className="flex items-center gap-3 justify-center mt-3">
      {weeks > 0 && (
        <div className="text-center">
          <div className="text-foreground text-2xl font-bold font-mono">{weeks}</div>
          <div className="text-muted text-[9px] uppercase tracking-wider">weeks</div>
        </div>
      )}
      {weeks > 0 && (
        <div className="text-muted text-lg">:</div>
      )}
      <div className="text-center">
        <div className="text-foreground text-2xl font-bold font-mono">{weeks > 0 ? remainingDays : days}</div>
        <div className="text-muted text-[9px] uppercase tracking-wider">days</div>
      </div>
    </div>
  );
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

  return (
    <div className="border-border rounded border p-5 space-y-4">
      {/* Title + Tagline */}
      <div className="text-center">
        <h2 className="text-foreground text-xl font-bold leading-tight">
          PLOT Big or Nothing Airdrop
        </h2>
        <p className="text-accent text-sm font-medium mt-1">
          {data.poolAmount.toLocaleString()} PLOT locked. Earn or burn.
        </p>
      </div>

      {/* Countdown */}
      {data.timeRemainingDays > 0 && (
        <div>
          <CountdownDisplay days={data.timeRemainingDays} />
          <div className="mt-2">
            <div className="bg-surface border-border h-1.5 rounded border overflow-hidden">
              <div
                className="bg-accent h-full transition-all"
                style={{ width: `${data.timeElapsedPercent}%` }}
              />
            </div>
            <div className="text-muted text-[10px] mt-0.5 text-right">
              {data.timeElapsedPercent}% elapsed
            </div>
          </div>
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
            {data.latestPriceUsd ? formatUsdValue(data.latestPriceUsd) : "\u2014"}
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
