"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUsdValue } from "../../../lib/usd-price";
import { AIRDROP_TEST_MODE } from "../../../lib/airdrop/config";

/* ─── Types ─── */

interface StatusData {
  campaignStart: string;
  campaignEnd: string;
  timeRemainingDays: number;
  timeElapsedPercent: number;
  poolAmount: number;
  currentFdv: number;
  latestPriceUsd: number | null;
  milestones: {
    bronze: { mcap: number; pct: number; reached: boolean };
    silver: { mcap: number; pct: number; reached: boolean };
    gold: { mcap: number; pct: number; reached: boolean };
    diamond: { mcap: number; pct: number; reached: boolean };
  };
  totalPointsEarned: number;
  totalParticipants: number;
  lockerTx: string | null;
}

/* ─── Constants ─── */

const MAX_SUPPLY = 1_000_000;

const TIER_KEYS = ["bronze", "silver", "gold", "diamond"] as const;

interface MilestoneRow {
  fdv: number;
  pct: number;
  unlockPlot: number;
  poolUsd: number;
  burnPct: number;
  cmcRank: string | null;
  isFull: boolean;
}

const CMC_RANKS = ["≈ CMC #1900", "≈ CMC #950", "≈ CMC #400", "≈ CMC #250"];

/* ─── Helpers ─── */

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

function formatCompact(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

function useCountdown(endDateStr: string) {
  const [remaining, setRemaining] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const endMs = new Date(endDateStr + "T00:00:00Z").getTime();
    function update() {
      const diff = Math.max(0, endMs - Date.now());
      const totalSec = Math.floor(diff / 1000);
      setRemaining({
        d: Math.floor(totalSec / 86400),
        h: Math.floor((totalSec % 86400) / 3600),
        m: Math.floor((totalSec % 3600) / 60),
        s: totalSec % 60,
      });
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endDateStr]);

  return remaining;
}

function buildMilestoneRows(
  milestones: StatusData["milestones"],
  poolAmount: number,
): MilestoneRow[] {
  return TIER_KEYS.map((key, i) => {
    const ms = milestones[key];
    const price = ms.mcap / MAX_SUPPLY;
    const unlockPlot = poolAmount * (ms.pct / 100);
    return {
      fdv: ms.mcap,
      pct: ms.pct,
      unlockPlot,
      poolUsd: unlockPlot * price,
      burnPct: 100 - ms.pct,
      cmcRank: AIRDROP_TEST_MODE ? null : (CMC_RANKS[i] ?? null),
      isFull: ms.pct === 100,
    };
  });
}

function getCurrentBurnState(
  currentFdv: number,
  milestones: StatusData["milestones"],
  poolAmount: number,
): { burnPct: number; distributePct: number; poolUsd: number } {
  const entries = TIER_KEYS.map((k) => milestones[k]);
  let highestPct = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (currentFdv >= entries[i].mcap) {
      highestPct = entries[i].pct;
      break;
    }
  }
  const price = currentFdv / MAX_SUPPLY;
  const unlockPlot = poolAmount * (highestPct / 100);
  return {
    burnPct: 100 - highestPct,
    distributePct: highestPct,
    poolUsd: unlockPlot * price,
  };
}

/* ─── Burn Bar ─── */

function BurnBar({
  burnPct,
  distributePct,
  currentFdv,
  poolUsd,
}: {
  burnPct: number;
  distributePct: number;
  currentFdv: number;
  poolUsd: number;
}) {
  const isFull = distributePct >= 100;
  const isAllBurned = burnPct >= 100;

  return (
    <div className="border-border bg-surface rounded border p-4 space-y-3">
      <div className="text-foreground text-xs font-bold uppercase tracking-wider">
        If the campaign ended right now...
      </div>

      <div className="h-5 w-full rounded overflow-hidden flex">
        {burnPct > 0 && (
          <div
            className="h-full transition-all duration-700"
            style={{
              width: `${burnPct}%`,
              background: "linear-gradient(90deg, #CC3333, #E8650A)",
            }}
          />
        )}
        {distributePct > 0 && (
          <div
            className="h-full transition-all duration-700"
            style={{
              width: `${distributePct}%`,
              background: "linear-gradient(90deg, #2D8B4E, #00CC66)",
            }}
          />
        )}
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className={isAllBurned ? "text-[#CC3333] font-bold" : "text-muted"}>
          ← {burnPct}% BURNED
        </span>
        <span className={isFull ? "text-[#00CC66] font-bold" : "text-muted"}>
          {isFull ? "FULL DISTRIBUTION" : `${distributePct}% distributed →`}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">
          Current MCap: {currentFdv > 0 ? formatUsdValue(currentFdv) : "—"}
        </span>
        <span className="text-foreground font-bold">
          Pool value right now: {poolUsd > 0 ? formatUsdValue(poolUsd) : "$0"}
        </span>
      </div>
    </div>
  );
}

/* ─── Main component ─── */

export function CampaignHero() {
  const { data, isLoading } = useAirdropStatus();
  const countdown = useCountdown(data?.campaignEnd ?? "2027-01-01");

  const milestoneRows = useMemo(
    () => (data ? buildMilestoneRows(data.milestones, data.poolAmount) : []),
    [data],
  );

  const burnState = useMemo(
    () =>
      data
        ? getCurrentBurnState(data.currentFdv, data.milestones, data.poolAmount)
        : { burnPct: 100, distributePct: 0, poolUsd: 0 },
    [data],
  );

  if (isLoading || !data) {
    return (
      <div className="border-border rounded border p-4">
        <div className="text-muted text-sm">Loading campaign status...</div>
      </div>
    );
  }

  const pad2 = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="border-border rounded border p-5 space-y-6">
      {/* ── Bold headline ── */}
      <div className="text-center space-y-2">
        <h2 className="text-foreground text-xl sm:text-2xl font-bold leading-tight tracking-tight">
          5% OF ALL PLOT — LOCKED
        </h2>
        <p className="text-muted text-sm sm:text-base font-bold uppercase tracking-wide">
          Grow the market. Or watch it burn.
        </p>
      </div>

      {/* ── Countdown ── */}
      {data.timeRemainingDays > 0 && (
        <div className="flex items-center gap-2 justify-center">
          {[
            { val: countdown.d, label: "days" },
            { val: countdown.h, label: "hrs" },
            { val: countdown.m, label: "min" },
            { val: countdown.s, label: "sec" },
          ].map((unit, i) => (
            <div key={unit.label} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted text-lg font-mono">:</span>}
              <div className="text-center">
                <div className="text-foreground text-2xl font-bold font-mono tabular-nums">
                  {i === 0 ? unit.val : pad2(unit.val)}
                </div>
                <div className="text-muted text-[9px] uppercase tracking-wider">{unit.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Lock-up proof ── */}
      <div className="text-center">
        {data.lockerTx ? (
          <a
            href={`https://basescan.org/tx/${data.lockerTx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent text-xs hover:underline inline-flex items-center gap-1"
          >
            <span>&#x1F512;</span> Verified on Basescan
          </a>
        ) : (
          <span className="text-muted text-xs inline-flex items-center gap-1">
            <span>&#x1F512;</span> Lock-up proof: pending
          </span>
        )}
      </div>

      {/* ── Burn bar ── */}
      <BurnBar
        burnPct={burnState.burnPct}
        distributePct={burnState.distributePct}
        currentFdv={data.currentFdv}
        poolUsd={burnState.poolUsd}
      />

      {/* ── Section 1: Your airdrop grows with $PLOT ── */}
      <div className="space-y-3">
        <div className="text-foreground text-xs font-bold uppercase tracking-wider text-center">
          Your airdrop grows with $PLOT
        </div>
        <p className="text-muted text-xs text-center max-w-md mx-auto">
          The pool is {data.poolAmount.toLocaleString()} PLOT. Its value depends on the market.
        </p>

        <div className="border-border rounded border overflow-hidden">
          {/* "Now" row */}
          <div className="grid grid-cols-3 gap-x-4 py-2.5 px-3 text-xs bg-surface">
            <span className="text-muted font-bold">Now</span>
            <span className="text-muted">MCap {data.currentFdv > 0 ? formatCompact(data.currentFdv) : "—"}</span>
            <span className="text-muted">Pool value: {data.currentFdv > 0 ? formatUsdValue(burnState.poolUsd) : "$0"}</span>
          </div>
          {/* Milestone rows */}
          {milestoneRows.map((row) => (
            <div key={row.fdv} className="grid grid-cols-3 gap-x-4 py-2.5 px-3 text-xs border-border border-t">
              <span className={row.isFull ? "text-accent font-bold" : "text-foreground font-medium"}>
                Step {milestoneRows.indexOf(row) + 1}
              </span>
              <span className="text-foreground">MCap {formatCompact(row.fdv)}</span>
              <span className={row.isFull ? "text-accent font-bold" : "text-foreground"}>
                Pool ~{formatCompact(row.poolUsd)}
              </span>
            </div>
          ))}
        </div>

        <p className="text-muted text-[11px] text-center max-w-md mx-auto leading-relaxed">
          The same {data.poolAmount.toLocaleString()} PLOT — worth{" "}
          {data.currentFdv > 0 ? formatUsdValue(burnState.poolUsd) : "$0"} today, or{" "}
          ~{formatCompact(milestoneRows[milestoneRows.length - 1]?.poolUsd ?? 0)} at full distribution.
          Your airdrop size = market growth.
        </p>
      </div>

      {/* ── Section 2: Four steps — not unrealistic ── */}
      <div className="space-y-3">
        <div className="text-foreground text-xs font-bold uppercase tracking-wider text-center">
          Four steps — not unrealistic
        </div>
        <p className="text-muted text-xs text-center max-w-md mx-auto">
          Each step unlocks a bigger share of the pool.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {milestoneRows.map((row) => {
            const reached = data.currentFdv >= row.fdv;
            return (
              <div
                key={row.fdv}
                className={`rounded border px-3 py-3 text-center space-y-1.5 ${
                  reached ? "border-accent" : "border-border opacity-60"
                }`}
              >
                <div className={`text-sm font-bold ${reached ? "text-accent" : "text-foreground"}`}>
                  {formatCompact(row.fdv)}
                </div>
                {row.cmcRank && (
                  <div className="text-muted text-[10px]">{row.cmcRank}</div>
                )}
                <div className="text-muted text-[10px]">unlocks</div>
                <div className={`text-xs font-bold ${reached ? "text-accent" : "text-foreground"}`}>
                  {row.pct}%
                </div>
              </div>
            );
          })}
        </div>

        {!AIRDROP_TEST_MODE && (
          <p className="text-muted text-[11px] text-center max-w-md mx-auto leading-relaxed">
            These aren&apos;t moonshot numbers — #250 on CMC is a mid-tier project.
            Thousands of tokens have done it.
          </p>
        )}
      </div>

      {/* ── Section 3: Not reached? Burned forever. ── */}
      <div className="space-y-3">
        <div className="text-foreground text-xs font-bold uppercase tracking-wider text-center">
          Not reached? Burned forever.
        </div>

        <div className="border-border bg-surface rounded border px-4 py-4 text-center space-y-2">
          <div className="text-foreground text-sm font-bold">
            If MCap stays below {formatCompact(milestoneRows[0]?.fdv ?? 0)}:
          </div>
          <div className="text-foreground text-base">
            {data.poolAmount.toLocaleString()} PLOT &rarr; burned permanently &#x1F525;
          </div>
          <p className="text-muted text-xs leading-relaxed max-w-sm mx-auto">
            No team keeps it. No treasury recycles it.<br />
            Burned = reduced supply = value for holders.
          </p>
        </div>

        <p className="text-muted text-[11px] text-center max-w-md mx-auto leading-relaxed">
          Either way, PLOT holders benefit:<br />
          reach milestones &rarr; earn airdrop.
          Miss milestones &rarr; supply shrinks.
        </p>
      </div>

      {/* ── Participant count ── */}
      <div className="text-center text-muted text-xs">
        {data.totalParticipants > 0
          ? `${data.totalParticipants} participants earning`
          : "Be the first to participate"}
      </div>

      {/* ── MCap explanation footnote ── */}
      <div className="text-center text-muted text-[10px]">
        MCap = PLOT price × 1M max supply
      </div>
    </div>
  );
}
