"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUsdValue } from "../../../lib/usd-price";

interface StatusData {
  poolAmount: number;
  currentFdv: number;
  latestPriceUsd: number | null;
  milestones: {
    bronze: { mcap: number; pct: number; reached: boolean };
    silver: { mcap: number; pct: number; reached: boolean };
    gold: { mcap: number; pct: number; reached: boolean };
    diamond: { mcap: number; pct: number; reached: boolean };
  };
}

/* ─── Chart tier definitions (presentation layer) ─── */

const MAX_SUPPLY = 1_000_000;

/** Visual presentation per tier; FDV and poolPct come from API/config. */
const TIER_PRESENTATION = [
  { key: "bronze" as const, label: "Bronze", emoji: "\uD83E\uDD49" },
  { key: "silver" as const, label: "Silver", emoji: "\uD83E\uDD48" },
  { key: "gold" as const, label: "Gold", emoji: "\uD83E\uDD47" },
  { key: "diamond" as const, label: "Diamond", emoji: "\uD83D\uDC8E" },
];

/** Pool USD value at a given FDV milestone: poolAmount * (pct/100) * (fdv / maxSupply) */
function poolUsdAt(fdv: number, poolPct: number, poolAmount: number): number {
  return poolAmount * (poolPct / 100) * (fdv / MAX_SUPPLY);
}

type ChartMilestone = {
  fdv: number;
  poolUsd: number;
  label: string;
  emoji: string;
  poolPct: number;
};

/* ─── SVG layout constants ─── */

const SVG_W = 600;
const SVG_H = 300;
const PAD = { top: 40, right: 20, bottom: 50, left: 65 };
const CHART_W = SVG_W - PAD.left - PAD.right;
const CHART_H = SVG_H - PAD.top - PAD.bottom;

// Log scale helpers — FDV axis bounds derived from the active milestones so
// test mode (e.g. $7K bronze) and prod mode (e.g. $1M bronze) both render.
function computeFdvBounds(milestones: ChartMilestone[]): { logMin: number; logMax: number; floor: number } {
  const minFdv = Math.max(milestones[0].fdv / 100, 1);
  const maxFdv = milestones[milestones.length - 1].fdv * 2;
  return { logMin: Math.log10(minFdv), logMax: Math.log10(maxFdv), floor: minFdv };
}

function fdvToX(fdv: number, logMin: number, logMax: number, floor: number): number {
  if (fdv <= 0) return PAD.left;
  const logVal = Math.log10(Math.max(fdv, floor));
  const t = (logVal - logMin) / (logMax - logMin);
  return PAD.left + t * CHART_W;
}

function usdToY(usd: number, yMax: number): number {
  const t = usd / yMax;
  return PAD.top + CHART_H * (1 - t);
}

/* ─── Path builders ─── */

function buildAreaPath(milestones: ChartMilestone[], yMax: number, logMin: number, logMax: number, floor: number): string {
  const baseline = usdToY(0, yMax);
  let path = `M ${fdvToX(floor, logMin, logMax, floor)} ${baseline}`;
  let prevY = baseline;
  for (const m of milestones) {
    const x = fdvToX(m.fdv, logMin, logMax, floor);
    const y = usdToY(m.poolUsd, yMax);
    path += ` L ${x} ${prevY} L ${x} ${y}`;
    prevY = y;
  }
  path += ` L ${PAD.left + CHART_W} ${prevY}`;
  path += ` L ${PAD.left + CHART_W} ${baseline} Z`;
  return path;
}

function buildLinePath(milestones: ChartMilestone[], yMax: number, logMin: number, logMax: number, floor: number): string {
  let path = "";
  let prevY = usdToY(0, yMax);
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    const x = fdvToX(m.fdv, logMin, logMax, floor);
    const y = usdToY(m.poolUsd, yMax);
    if (i === 0) {
      path = `M ${fdvToX(floor, logMin, logMax, floor)} ${prevY} L ${x} ${prevY} L ${x} ${y}`;
    } else {
      path += ` L ${x} ${prevY} L ${x} ${y}`;
    }
    prevY = y;
  }
  path += ` L ${PAD.left + CHART_W} ${prevY}`;
  return path;
}

/* ─── Component ─── */

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

  const milestones: ChartMilestone[] = useMemo(
    () =>
      TIER_PRESENTATION.map((t) => {
        const ms = data?.milestones?.[t.key];
        return {
          label: t.label,
          emoji: t.emoji,
          fdv: ms?.mcap ?? 0,
          poolPct: ms?.pct ?? 0,
          poolUsd: poolUsdAt(ms?.mcap ?? 0, ms?.pct ?? 0, data?.poolAmount ?? 0),
        };
      }),
    [data?.milestones, data?.poolAmount],
  );

  if (isLoading || !data) {
    return (
      <div className="border-border rounded border p-4">
        <div className="text-muted text-sm">Loading milestones...</div>
      </div>
    );
  }

  const { logMin, logMax, floor } = computeFdvBounds(milestones);

  // Y-axis max with 10% headroom above Diamond
  const yMax = milestones[milestones.length - 1].poolUsd * 1.1;

  // Y-axis ticks: evenly space 4 ticks from 0 to Diamond poolUsd
  const diamondUsd = milestones[milestones.length - 1].poolUsd;
  const yTicks = [0, diamondUsd * 0.2, diamondUsd * 0.5, diamondUsd];

  // FDV = price * max supply
  const currentFdv =
    data.latestPriceUsd != null && data.latestPriceUsd > 0
      ? data.latestPriceUsd * MAX_SUPPLY
      : 0;

  // Determine current zone
  const currentZone = milestones.reduce(
    (zone, m, i) => (currentFdv >= m.fdv ? i + 1 : zone),
    0,
  );
  const currentZoneLabel =
    currentZone === 0 ? "Pre-Bronze" : milestones[currentZone - 1].label;

  const currentPoolUsd =
    currentZone > 0 ? milestones[currentZone - 1].poolUsd : 0;

  const dotX = fdvToX(Math.max(currentFdv, floor), logMin, logMax, floor);
  const dotY = usdToY(currentPoolUsd, yMax);

  const areaPath = buildAreaPath(milestones, yMax, logMin, logMax, floor);
  const linePath = buildLinePath(milestones, yMax, logMin, logMax, floor);

  return (
    <div className="border-border rounded border p-4">
      <h3 className="text-foreground text-sm font-bold mb-1">
        FDV Milestone Chart
      </h3>
      <p className="text-muted text-[10px] mb-3">
        Pool unlock curve across FDV milestones &middot; FDV = PLOT price
        &times; {MAX_SUPPLY.toLocaleString()} max supply
      </p>

      <div className="w-full overflow-x-auto -mx-1 px-1">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-auto"
          style={{ minWidth: 320 }}
          role="img"
          aria-label="FDV milestone chart showing pool value unlock curve across Bronze, Silver, Gold, and Diamond tiers"
        >
          <defs>
            <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B4513" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#8B4513" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Y-axis grid lines */}
          {yTicks.map((val) => (
            <g key={val}>
              <line
                x1={PAD.left}
                y1={usdToY(val, yMax)}
                x2={PAD.left + CHART_W}
                y2={usdToY(val, yMax)}
                stroke="#D4C5B0"
                strokeWidth={0.5}
                strokeDasharray={val === 0 ? "0" : "3,3"}
              />
              <text
                x={PAD.left - 6}
                y={usdToY(val, yMax) + 3}
                textAnchor="end"
                fill="#8B7355"
                fontSize={9}
                fontFamily="Inter, system-ui, sans-serif"
              >
                {val === 0 ? "$0" : formatUsdValue(val)}
              </text>
            </g>
          ))}

          {/* Filled area */}
          <path d={areaPath} fill="url(#area-grad)" />

          {/* Step line */}
          <path d={linePath} fill="none" stroke="#8B4513" strokeWidth={2} />

          {/* Vertical zone dividers + annotations */}
          {milestones.map((m) => {
            const x = fdvToX(m.fdv, logMin, logMax, floor);
            const y = usdToY(m.poolUsd, yMax);
            return (
              <g key={m.label}>
                <line
                  x1={x}
                  y1={PAD.top}
                  x2={x}
                  y2={PAD.top + CHART_H}
                  stroke="#D4C5B0"
                  strokeWidth={0.5}
                  strokeDasharray="4,3"
                />
                <text
                  x={x}
                  y={PAD.top - 6}
                  textAnchor="middle"
                  fill="#2C1810"
                  fontSize={10}
                  fontFamily="Inter, system-ui, sans-serif"
                  fontWeight="600"
                >
                  {m.emoji} {m.label}
                </text>
                <text
                  x={x}
                  y={PAD.top - 18}
                  textAnchor="middle"
                  fill="#8B7355"
                  fontSize={8}
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {m.poolPct}% ({formatUsdValue(m.poolUsd)})
                </text>
                <circle
                  cx={x}
                  cy={y}
                  r={3}
                  fill="#8B4513"
                  stroke="#F0EBE1"
                  strokeWidth={1.5}
                />
              </g>
            );
          })}

          {/* X-axis labels */}
          {milestones.map((m) => (
            <text
              key={m.label}
              x={fdvToX(m.fdv, logMin, logMax, floor)}
              y={PAD.top + CHART_H + 14}
              textAnchor="middle"
              fill="#8B7355"
              fontSize={9}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {formatUsdValue(m.fdv)}
            </text>
          ))}

          {/* Axis labels */}
          <text
            x={PAD.left + CHART_W / 2}
            y={SVG_H - 4}
            textAnchor="middle"
            fill="#8B7355"
            fontSize={10}
            fontFamily="Inter, system-ui, sans-serif"
          >
            FDV &rarr;
          </text>
          <text
            x={12}
            y={PAD.top + CHART_H / 2}
            textAnchor="middle"
            fill="#8B7355"
            fontSize={10}
            fontFamily="Inter, system-ui, sans-serif"
            transform={`rotate(-90, 12, ${PAD.top + CHART_H / 2})`}
          >
            Pool Value
          </text>

          {/* Current FDV indicator — dot on x-axis, dashed line up to area */}
          {currentFdv > 0 && (
            <g>
              {/* Vertical dashed line from x-axis up to the step level */}
              <line
                x1={dotX}
                y1={PAD.top + CHART_H}
                x2={dotX}
                y2={dotY}
                stroke="#8B4513"
                strokeWidth={1}
                strokeDasharray="3,3"
                opacity={0.6}
              />
              {/* Small marker at the step intersection */}
              <circle
                cx={dotX}
                cy={dotY}
                r={2.5}
                fill="#8B4513"
                opacity={0.5}
              />
              {/* Pulse ring on x-axis */}
              <circle
                cx={dotX}
                cy={PAD.top + CHART_H}
                r={6}
                fill="none"
                stroke="#8B4513"
                strokeWidth={1.5}
                opacity={0.4}
              >
                <animate
                  attributeName="r"
                  values="6;12;6"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.4;0;0.4"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Heartbeat dot on x-axis */}
              <circle cx={dotX} cy={PAD.top + CHART_H} r={4} fill="#8B4513">
                <animate
                  attributeName="r"
                  values="4;5.6;4"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="1;0.7;1"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* FDV label below axis */}
              <text
                x={dotX}
                y={PAD.top + CHART_H + 28}
                textAnchor="middle"
                fill="#8B4513"
                fontSize={9}
                fontWeight="bold"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {formatUsdValue(currentFdv)}
              </text>
              <text
                x={dotX}
                y={PAD.top + CHART_H + 39}
                textAnchor="middle"
                fill="#8B4513"
                fontSize={7}
                fontFamily="Inter, system-ui, sans-serif"
              >
                Current
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Current position summary */}
      <div className="text-center mt-3 space-y-0.5">
        <div className="text-foreground text-xs font-medium">
          Current FDV: {currentFdv > 0 ? formatUsdValue(currentFdv) : "\u2014"}
          <span className="text-muted"> &middot; Zone: {currentZoneLabel}</span>
        </div>
        {currentFdv > 0 && currentZone < milestones.length && (
          <div className="text-muted text-[10px]">
            Next: {milestones[currentZone].emoji}{" "}
            {milestones[currentZone].label} at{" "}
            {formatUsdValue(milestones[currentZone].fdv)} FDV
          </div>
        )}
      </div>
    </div>
  );
}
