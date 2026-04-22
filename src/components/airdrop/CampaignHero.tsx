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
  lockerId: string | null;
}

interface DailyPrice {
  date: string;
  fdv: number;
}

/* ─── Constants ─── */

const MAX_SUPPLY = 1_000_000;

const TIER_META = [
  { key: "bronze" as const, emoji: "\uD83E\uDD49", label: "Bronze" },
  { key: "silver" as const, emoji: "\uD83E\uDD48", label: "Silver" },
  { key: "gold" as const, emoji: "\uD83E\uDD47", label: "Gold" },
  { key: "diamond" as const, emoji: "\uD83D\uDC8E", label: "Diamond" },
];

type Tier = { key: string; emoji: string; label: string; fdv: number; pct: number };

/** Build tier array from API milestones so test/prod config is respected */
function buildTiers(milestones: StatusData["milestones"]): Tier[] {
  return TIER_META.map((m) => {
    const ms = milestones[m.key];
    return { ...m, fdv: ms.mcap, pct: ms.pct };
  });
}

/* ─── SVG layout ─── */

const SVG_W = 700;
const SVG_H = 340;
const PAD = { top: 30, right: 70, bottom: 40, left: 70 };
const CW = SVG_W - PAD.left - PAD.right;
const CH = SVG_H - PAD.top - PAD.bottom;

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

function useDailyPrices() {
  return useQuery<DailyPrice[]>({
    queryKey: ["airdrop-daily-prices"],
    queryFn: async () => {
      const res = await fetch("/api/airdrop/daily-prices");
      if (!res.ok) throw new Error("Failed to fetch daily prices");
      return res.json();
    },
    staleTime: 300_000,
  });
}

/** Pool value at current FDV: highest reached tier pct * pool * price */
function poolValueAtFdv(fdv: number, poolAmount: number, tiers: Tier[]): number {
  const price = fdv / MAX_SUPPLY;
  // Walk tiers in reverse to find highest reached
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (fdv >= tiers[i].fdv) return poolAmount * (tiers[i].pct / 100) * price;
  }
  return 0;
}

function currentZoneLabel(fdv: number, tiers: Tier[]): string {
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (fdv >= tiers[i].fdv) return tiers[i].label;
  }
  return "Pre-" + tiers[0].label;
}

function formatCompact(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
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

/* ─── Pure chart helpers (outside component to avoid unstable refs) ─── */

const FDV_LOG_MIN = Math.log10(100);

function timeToX(ms: number, startMs: number, totalMs: number): number {
  return PAD.left + ((ms - startMs) / totalMs) * CW;
}

function poolToY(usd: number, yLeftMax: number): number {
  return PAD.top + CH * (1 - usd / yLeftMax);
}

function fdvToY(fdv: number, logMax: number): number {
  if (fdv <= 0) return PAD.top + CH;
  const t = (Math.log10(Math.max(fdv, 100)) - FDV_LOG_MIN) / (logMax - FDV_LOG_MIN);
  return PAD.top + CH * (1 - t);
}

/* ─── Chart sub-component ─── */

function TimelineChart({
  campaignStart,
  campaignEnd,
  currentFdv,
  poolAmount,
  tiers,
}: {
  campaignStart: string;
  campaignEnd: string;
  currentFdv: number;
  poolAmount: number;
  tiers: Tier[];
}) {
  const { data: dailyPrices } = useDailyPrices();
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Refresh current time once per minute (chart doesn't need per-second updates)
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const startMs = new Date(campaignStart + "T00:00:00Z").getTime();
  const endMs = new Date(campaignEnd + "T00:00:00Z").getTime();
  const totalMs = endMs - startMs;

  const nowX = timeToX(Math.max(startMs, Math.min(nowMs, endMs)), startMs, totalMs);

  const diamondFdv = tiers[tiers.length - 1].fdv;
  const fdvLogMax = Math.log10(diamondFdv * 2); // 2x headroom above diamond
  const diamondPoolUsd = poolAmount * (diamondFdv / MAX_SUPPLY);
  const yLeftMax = diamondPoolUsd * 1.1;

  // Month labels for x-axis
  const months = useMemo(() => {
    const result: { label: string; ms: number }[] = [];
    const d = new Date(campaignStart + "T00:00:00Z");
    for (let i = 0; i < 7; i++) {
      const ms = d.getTime();
      if (ms <= endMs) {
        result.push({ label: `M${i + 1}`, ms });
      }
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    return result;
  }, [campaignStart, endMs]);

  // Effective data points: use daily prices if available, else synthesize from current FDV
  const hasHistory = !!(dailyPrices?.length && dailyPrices.some((dp) => {
    const dpMs = new Date(dp.date + "T00:00:00Z").getTime();
    return dpMs >= startMs && dpMs <= endMs;
  }));

  // Pool value step line from daily price data (or $0 flat line if no data)
  const poolStepPath = useMemo(() => {
    const baseline = poolToY(0, yLeftMax);
    if (!hasHistory) {
      // No data: flat $0 line from campaign start to now
      const currentPv = poolValueAtFdv(currentFdv, poolAmount, tiers);
      const pvY = currentPv > 0 ? poolToY(currentPv, yLeftMax) : baseline;
      return `M ${PAD.left.toFixed(1)} ${baseline.toFixed(1)} L ${nowX.toFixed(1)} ${pvY.toFixed(1)}`;
    }
    const parts: string[] = [];
    let lastPoolVal = 0;
    for (const dp of dailyPrices!) {
      const dpMs = new Date(dp.date + "T00:00:00Z").getTime();
      if (dpMs < startMs || dpMs > endMs) continue;
      const x = timeToX(dpMs, startMs, totalMs);
      const pv = poolValueAtFdv(dp.fdv, poolAmount, tiers);
      if (pv !== lastPoolVal && parts.length > 0) {
        parts.push(`L ${x.toFixed(1)} ${poolToY(lastPoolVal, yLeftMax).toFixed(1)}`);
      }
      parts.push(`${parts.length === 0 ? "M" : "L"} ${x.toFixed(1)} ${poolToY(pv, yLeftMax).toFixed(1)}`);
      lastPoolVal = pv;
    }
    if (parts.length > 0) {
      parts.push(`L ${nowX.toFixed(1)} ${poolToY(lastPoolVal, yLeftMax).toFixed(1)}`);
    }
    return parts.join(" ");
  }, [hasHistory, dailyPrices, startMs, endMs, totalMs, poolAmount, nowX, yLeftMax, tiers, currentFdv]);

  // Pool value area fill
  const poolAreaPath = useMemo(() => {
    if (!poolStepPath) return "";
    const baseline = poolToY(0, yLeftMax);
    if (!hasHistory) {
      // Area from campaign start baseline → pool step → back to baseline
      return `M ${PAD.left.toFixed(1)} ${baseline.toFixed(1)} ${poolStepPath.replace(/^M/, "L")} L ${nowX.toFixed(1)} ${baseline.toFixed(1)} Z`;
    }
    // Clamp area fill start to campaign start (daily prices may predate campaign)
    const firstX = dailyPrices?.length
      ? timeToX(Math.max(new Date(dailyPrices[0].date + "T00:00:00Z").getTime(), startMs), startMs, totalMs)
      : PAD.left;
    return `M ${firstX.toFixed(1)} ${baseline.toFixed(1)} ${poolStepPath.replace(/^M/, "L")} L ${nowX.toFixed(1)} ${baseline.toFixed(1)} Z`;
  }, [poolStepPath, hasHistory, dailyPrices, startMs, totalMs, nowX, yLeftMax]);

  // Actual FDV line (or single point if no history)
  const actualFdvPath = useMemo(() => {
    if (!hasHistory) {
      // No history: just draw a point at current position (will be rendered as dot)
      if (currentFdv <= 0) return "";
      const y = fdvToY(currentFdv, fdvLogMax);
      return `M ${nowX.toFixed(1)} ${y.toFixed(1)} L ${nowX.toFixed(1)} ${y.toFixed(1)}`;
    }
    const parts: string[] = [];
    for (const dp of dailyPrices!) {
      const dpMs = new Date(dp.date + "T00:00:00Z").getTime();
      if (dpMs < startMs || dpMs > endMs) continue;
      const x = timeToX(dpMs, startMs, totalMs);
      const y = fdvToY(dp.fdv, fdvLogMax);
      parts.push(`${parts.length === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    if (parts.length > 0 && currentFdv > 0) {
      parts.push(`L ${nowX.toFixed(1)} ${fdvToY(currentFdv, fdvLogMax).toFixed(1)}`);
    }
    return parts.join(" ");
  }, [hasHistory, dailyPrices, startMs, endMs, totalMs, currentFdv, nowX, fdvLogMax]);

  // Linear projection: from current position (nowX) → Diamond at campaign end
  const projectionPath = useMemo(() => {
    const toX = PAD.left + CW;
    const fromY = fdvToY(currentFdv > 0 ? currentFdv : 100, fdvLogMax);
    const toY = fdvToY(diamondFdv, fdvLogMax);
    return `M ${nowX} ${fromY} L ${toX} ${toY}`;
  }, [currentFdv, nowX, diamondFdv, fdvLogMax]);

  const dotY = fdvToY(currentFdv > 0 ? currentFdv : 100, fdvLogMax);

  const milestoneLines = tiers.map((t) => ({
    ...t,
    y: fdvToY(t.fdv, fdvLogMax),
  }));

  const yLeftTicks = [0, diamondPoolUsd * 0.25, diamondPoolUsd * 0.5, diamondPoolUsd];
  // Right-axis ticks omitted — milestone emoji labels already show FDV values

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full h-auto"
        role="img"
        aria-label="6-month timeline chart showing actual FDV, linear projection to Diamond, and airdrop pool value"
      >
        <defs>
          <linearGradient id="pool-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B4513" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#8B4513" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {/* Grid lines (horizontal at each milestone FDV) */}
        {milestoneLines.map((m) => (
          <g key={m.key}>
            <line
              x1={PAD.left}
              y1={m.y}
              x2={PAD.left + CW}
              y2={m.y}
              stroke="#D4C5B0"
              strokeWidth={0.5}
              strokeDasharray="4,4"
            />
            {/* Right-side label */}
            <text
              x={PAD.left + CW + 4}
              y={m.y + 3}
              fill="#8B7355"
              fontSize={8}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {m.emoji} {formatCompact(m.fdv)}
            </text>
          </g>
        ))}

        {/* Y-left axis ticks (pool value) — hidden on mobile */}
        <g className="hidden sm:block">
          {yLeftTicks.map((val) => (
            <text
              key={val}
              x={PAD.left - 6}
              y={poolToY(val, yLeftMax) + 3}
              textAnchor="end"
              fill="#8B7355"
              fontSize={8}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {formatCompact(val)}
            </text>
          ))}
        </g>

        {/* X-axis month labels */}
        {months.map((m) => (
          <g key={m.label}>
            <line
              x1={timeToX(m.ms, startMs, totalMs)}
              y1={PAD.top}
              x2={timeToX(m.ms, startMs, totalMs)}
              y2={PAD.top + CH}
              stroke="#D4C5B0"
              strokeWidth={0.3}
            />
            <text
              x={timeToX(m.ms, startMs, totalMs)}
              y={PAD.top + CH + 14}
              textAnchor="middle"
              fill="#8B7355"
              fontSize={9}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {m.label}
            </text>
          </g>
        ))}

        {/* Axis labels — hidden on mobile via CSS media query */}
        <text
          x={12}
          y={PAD.top + CH / 2}
          textAnchor="middle"
          fill="#8B7355"
          fontSize={9}
          fontFamily="Inter, system-ui, sans-serif"
          transform={`rotate(-90, 12, ${PAD.top + CH / 2})`}
          className="hidden sm:block"
        >
          Pool Value (USD)
        </text>
        <text
          x={SVG_W - 8}
          y={PAD.top + CH / 2}
          textAnchor="middle"
          fill="#8B7355"
          fontSize={9}
          fontFamily="Inter, system-ui, sans-serif"
          transform={`rotate(90, ${SVG_W - 8}, ${PAD.top + CH / 2})`}
          className="hidden sm:block"
        >
          FDV (USD)
        </text>

        {/* 1. Pool value area fill */}
        {poolAreaPath && (
          <path d={poolAreaPath} fill="url(#pool-area-grad)" />
        )}

        {/* 2. Pool value step line */}
        {poolStepPath && (
          <path
            d={poolStepPath}
            fill="none"
            stroke="#8B4513"
            strokeWidth={2}
            opacity={0.6}
          />
        )}

        {/* 3. Linear FDV projection (dashed) */}
        <path
          d={projectionPath}
          fill="none"
          stroke="#8B7355"
          strokeWidth={1.5}
          strokeDasharray="6,4"
          opacity={0.5}
        />

        {/* 4. Actual FDV line (solid) */}
        {actualFdvPath && (
          <path
            d={actualFdvPath}
            fill="none"
            stroke="#2C1810"
            strokeWidth={2}
          />
        )}

        {/* Heartbeat dot on current FDV position */}
        {currentFdv > 0 && (
          <g>
            {/* Pulse ring */}
            <circle cx={nowX} cy={dotY} r={6} fill="none" stroke="#8B4513" strokeWidth={1.5} opacity={0.4}>
              <animate attributeName="r" values="6;12;6" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0;0.4" dur="1.5s" repeatCount="indefinite" />
            </circle>
            {/* Solid dot */}
            <circle cx={nowX} cy={dotY} r={4} fill="#8B4513">
              <animate attributeName="r" values="4;5.6;4" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.7;1" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </g>
        )}

        {/* Chart border */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={CW}
          height={CH}
          fill="none"
          stroke="#D4C5B0"
          strokeWidth={0.5}
        />
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2 text-[10px]">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 bg-[#2C1810]" /> Actual FDV
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 border-t border-dashed border-[#8B7355]" /> Linear projection
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 bg-[#8B4513] opacity-60" /> Pool value
        </span>
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

  return (
    <div className="border-border rounded border p-5 space-y-5">
      {/* Title + Explanation */}
      <div className="text-center space-y-2">
        <h2 className="text-foreground text-xl font-bold leading-tight">
          PLOT Big or Nothing Airdrop
        </h2>
        <p className="text-muted text-xs leading-relaxed max-w-lg mx-auto">
          {data.poolAmount.toLocaleString()} PLOT (5% of max supply) locked in a time-locked contract.
          If PLOT FDV reaches milestone targets within 6 months, the pool is distributed to point holders.
          If not, it&apos;s burned forever.
        </p>

        {/* Lock-up proof */}
        {data.lockerId ? (
          <a
            href={`https://mint.club/locker/${data.lockerId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent text-xs hover:underline inline-flex items-center gap-1"
          >
            <span>&#x1F512;</span> View lock-up proof on Mint Club
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

      {/* 6-Month Timeline Chart */}
      <TimelineChart
        campaignStart={data.campaignStart}
        campaignEnd={data.campaignEnd}
        currentFdv={data.currentFdv}
        poolAmount={data.poolAmount}
        tiers={tiers}
      />

      {/* Current position summary */}
      <div className="text-center space-y-0.5">
        <div className="text-foreground text-xs font-medium">
          Current FDV: {data.currentFdv > 0 ? formatUsdValue(data.currentFdv) : "\u2014"}
          <span className="text-muted"> &middot; Zone: {currentZoneLabel(data.currentFdv, tiers)}</span>
        </div>
        <div className="text-muted text-[10px]">
          Pool value: {data.currentFdv > 0 ? formatUsdValue(poolValueAtFdv(data.currentFdv, data.poolAmount, tiers)) : "$0"}
        </div>
      </div>
    </div>
  );
}
