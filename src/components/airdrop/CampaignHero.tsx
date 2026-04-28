"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUsdValue } from "../../../lib/usd-price";

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

const TIER_META = [
  { key: "bronze" as const, emoji: "🥉", label: "Bronze", cmcRank: 1900 },
  { key: "silver" as const, emoji: "🥈", label: "Silver", cmcRank: 950 },
  { key: "gold" as const, emoji: "🥇", label: "Gold", cmcRank: 400 },
  { key: "diamond" as const, emoji: "💎", label: "Diamond", cmcRank: 250 },
];

type Tier = {
  key: string;
  emoji: string;
  label: string;
  cmcRank: number;
  fdv: number;
  pct: number;
  reached: boolean;
};

const IS_PROD_MODE = process.env.NEXT_PUBLIC_AIRDROP_MODE !== "test";

/** Build tier array from API milestones so test/prod config is respected */
function buildTiers(milestones: StatusData["milestones"]): Tier[] {
  return TIER_META.map((m) => {
    const ms = milestones[m.key];
    return { ...m, fdv: ms.mcap, pct: ms.pct, reached: ms.reached };
  });
}

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

/** Pool USD at a given milestone: poolAmount * (pct/100) * (fdv / maxSupply). */
function poolUsdAtTier(tier: Tier, poolAmount: number): number {
  return poolAmount * (tier.pct / 100) * (tier.fdv / MAX_SUPPLY);
}

/** PLOT unlocked at a given milestone. */
function plotAtTier(tier: Tier, poolAmount: number): number {
  return poolAmount * (tier.pct / 100);
}

/* ─── Countdown hook ─── */

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

/* ─── Segmented progress bar ─── */

/**
 * 4-segment progress bar. Each segment represents one milestone tier and
 * fills based on log-scale progress between adjacent milestones, so reaching
 * Bronze visibly fills the first segment instead of looking like 1% of the bar.
 */
function SegmentedProgressBar({
  tiers,
  currentFdv,
}: {
  tiers: Tier[];
  currentFdv: number;
}) {
  const segments = useMemo(() => {
    return tiers.map((t, i) => {
      const lowerFdv = i === 0 ? t.fdv / 10 : tiers[i - 1].fdv;
      let fillPct = 0;
      if (currentFdv >= t.fdv) {
        fillPct = 100;
      } else if (currentFdv > lowerFdv) {
        const logCur = Math.log10(currentFdv);
        const logLow = Math.log10(lowerFdv);
        const logHi = Math.log10(t.fdv);
        fillPct = ((logCur - logLow) / (logHi - logLow)) * 100;
      }
      return { ...t, fillPct };
    });
  }, [tiers, currentFdv]);

  const indicatorIdx = segments.findIndex((s) => s.fillPct < 100 && s.fillPct > 0);
  const indicatorSegment =
    indicatorIdx === -1
      ? segments.findIndex((s) => s.fillPct === 0)
      : indicatorIdx;

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {segments.map((s) => (
          <div
            key={s.key}
            className="bg-surface border-border h-3 flex-1 rounded border overflow-hidden"
            aria-label={`${s.label} progress: ${Math.round(s.fillPct)}%`}
          >
            <div
              className="bg-accent h-full transition-all"
              style={{ width: `${s.fillPct}%` }}
            />
          </div>
        ))}
      </div>

      <div className="flex gap-1">
        {segments.map((s, i) => (
          <div
            key={s.key}
            className={`flex-1 text-center text-[10px] leading-tight ${
              s.fillPct === 100 ? "text-accent" : "text-muted"
            }`}
          >
            <div className="font-medium">
              {s.emoji} {formatUsdValue(s.fdv)}
            </div>
            {indicatorSegment === i && currentFdv > 0 && (
              <div className="text-foreground text-[9px] mt-0.5">
                <span aria-hidden>▲</span> Current: {formatUsdValue(currentFdv)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Milestone card ─── */

function MilestoneCard({
  tier,
  poolAmount,
  isCurrentTarget,
}: {
  tier: Tier;
  poolAmount: number;
  isCurrentTarget: boolean;
}) {
  const plot = plotAtTier(tier, poolAmount);
  const poolUsd = poolUsdAtTier(tier, poolAmount);
  const burnPct = 100 - tier.pct;

  const visualState = tier.reached
    ? "border-accent text-foreground"
    : isCurrentTarget
      ? "border-border text-foreground"
      : "border-border opacity-50";

  return (
    <div
      className={`rounded border px-3 py-2.5 space-y-1.5 ${visualState}`}
      data-state={tier.reached ? "reached" : isCurrentTarget ? "current" : "future"}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold">
          {tier.emoji} {tier.label}
        </div>
        {tier.reached && (
          <span className="text-accent text-[10px]" aria-label="reached">✓</span>
        )}
      </div>

      <div className="space-y-0.5 text-[11px]">
        <div className="flex justify-between gap-2">
          <span className="text-muted">FDV</span>
          <span className="font-mono">{formatUsdValue(tier.fdv)}</span>
        </div>

        {IS_PROD_MODE && (
          <div className="flex justify-between gap-2">
            <span className="text-muted">CMC</span>
            <span className="text-muted font-mono">~#{tier.cmcRank.toLocaleString()}</span>
          </div>
        )}

        <div className="flex justify-between gap-2 pt-0.5">
          <span className="text-muted">Unlock</span>
          <span className="font-mono">{tier.pct}%</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted">PLOT</span>
          <span className="font-mono">{plot.toLocaleString()}</span>
        </div>

        <div className="flex justify-between gap-2 pt-0.5">
          <span className="text-muted">Pool</span>
          <span className="font-mono">~{formatUsdValue(poolUsd)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted">Burn</span>
          <span className="font-mono">{burnPct}%</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─── */

export function CampaignHero() {
  const { data, isLoading } = useAirdropStatus();
  const countdown = useCountdown(data?.campaignEnd ?? "2027-01-01");

  const tiers = useMemo(
    () => (data ? buildTiers(data.milestones) : []),
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

  // Current target = first unreached tier; null if all reached
  const currentTargetIdx = tiers.findIndex((t) => !t.reached);

  return (
    <div className="border-border rounded border p-5 space-y-5">
      {/* Title + Explanation */}
      <div className="text-center space-y-2">
        <h2 className="text-foreground text-xl font-bold leading-tight">
          PLOT Big or Nothing Airdrop
        </h2>
        <p className="text-muted text-xs leading-relaxed max-w-lg mx-auto">
          {data.poolAmount.toLocaleString()} PLOT locked in a time-locked contract.
          Reach milestone FDV targets and the pool is distributed to point holders.
          Miss them and the unreached portion is burned forever.
        </p>

        {/* Lock-up proof */}
        {data.lockerTx ? (
          <a
            href={`https://basescan.org/tx/${data.lockerTx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent text-xs hover:underline inline-flex items-center gap-1"
          >
            <span>&#x1F512;</span> View lock-up proof on Basescan
          </a>
        ) : (
          <span className="text-muted text-xs inline-flex items-center gap-1">
            <span>&#x1F512;</span> Lock-up proof: pending
          </span>
        )}
      </div>

      {/* Live Countdown */}
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

      {/* Segmented progress bar */}
      <SegmentedProgressBar tiers={tiers} currentFdv={data.currentFdv} />

      {/* Milestone cards: 2x2 mobile, 4-col desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tiers.map((t, i) => (
          <MilestoneCard
            key={t.key}
            tier={t}
            poolAmount={data.poolAmount}
            isCurrentTarget={i === currentTargetIdx}
          />
        ))}
      </div>
    </div>
  );
}
