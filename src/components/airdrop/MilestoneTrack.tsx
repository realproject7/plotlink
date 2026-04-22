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

/* ─── Chart milestones (presentation layer) ─── */

const MAX_SUPPLY = 1_000_000;
const CHART_MILESTONES = [
  { label: "Bronze", emoji: "\uD83E\uDD49", fdv: 1_000_000, poolPct: 10, poolUsd: 5_000 },
  { label: "Silver", emoji: "\uD83E\uDD48", fdv: 10_000_000, poolPct: 30, poolUsd: 150_000 },
  { label: "Gold", emoji: "\uD83E\uDD47", fdv: 50_000_000, poolPct: 50, poolUsd: 1_250_000 },
  { label: "Diamond", emoji: "\uD83D\uDC8E", fdv: 100_000_000, poolPct: 100, poolUsd: 5_000_000 },
] as const;

/* ─── SVG layout constants ─── */

const SVG_W = 600;
const SVG_H = 300;
const PAD = { top: 40, right: 20, bottom: 50, left: 65 };
const CHART_W = SVG_W - PAD.left - PAD.right;
const CHART_H = SVG_H - PAD.top - PAD.bottom;

// Log scale helpers — FDV axis from 10k to 200M
const LOG_MIN = Math.log10(10_000);      // 4
const LOG_MAX = Math.log10(200_000_000); // ~8.3

function fdvToX(fdv: number): number {
  if (fdv <= 0) return PAD.left;
  const logVal = Math.log10(Math.max(fdv, 10_000));
  const t = (logVal - LOG_MIN) / (LOG_MAX - LOG_MIN);
  return PAD.left + t * CHART_W;
}

// Y axis: pool USD value (linear, 0 to 5.5M)
const Y_MAX = 5_500_000;

function usdToY(usd: number): number {
  const t = usd / Y_MAX;
  return PAD.top + CHART_H * (1 - t);
}

/* ─── Y-axis tick values ─── */
const Y_TICKS = [0, 1_000_000, 2_500_000, 5_000_000];

/* ─── Step area path builder ─── */

function buildAreaPath(): string {
  const baseline = usdToY(0);
  // Start at origin
  let path = `M ${fdvToX(10_000)} ${baseline}`;
  // Step up at each milestone
  let prevY = baseline;
  for (const m of CHART_MILESTONES) {
    const x = fdvToX(m.fdv);
    const y = usdToY(m.poolUsd);
    // Horizontal to milestone x at previous level
    path += ` L ${x} ${prevY}`;
    // Step up to new level
    path += ` L ${x} ${y}`;
    prevY = y;
  }
  // Extend to right edge at last level
  path += ` L ${PAD.left + CHART_W} ${prevY}`;
  // Close back down to baseline
  path += ` L ${PAD.left + CHART_W} ${baseline}`;
  path += " Z";
  return path;
}

function buildLinePath(): string {
  let path = "";
  let prevY = usdToY(0);
  for (let i = 0; i < CHART_MILESTONES.length; i++) {
    const m = CHART_MILESTONES[i];
    const x = fdvToX(m.fdv);
    const y = usdToY(m.poolUsd);
    if (i === 0) {
      path = `M ${fdvToX(10_000)} ${prevY} L ${x} ${prevY} L ${x} ${y}`;
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

  if (isLoading || !data) {
    return (
      <div className="border-border rounded border p-4">
        <div className="text-muted text-sm">Loading milestones...</div>
      </div>
    );
  }

  // FDV = price * max supply
  const currentFdv =
    data.latestPriceUsd != null && data.latestPriceUsd > 0
      ? data.latestPriceUsd * MAX_SUPPLY
      : 0;

  // Determine current zone
  const currentZone = CHART_MILESTONES.reduce(
    (zone, m, i) => (currentFdv >= m.fdv ? i + 1 : zone),
    0,
  );
  const currentZoneLabel =
    currentZone === 0
      ? "Pre-Bronze"
      : CHART_MILESTONES[currentZone - 1].label;

  // Current pool value based on FDV position
  const currentPoolUsd =
    currentZone > 0 ? CHART_MILESTONES[currentZone - 1].poolUsd : 0;

  const dotX = fdvToX(Math.max(currentFdv, 10_000));
  const dotY = usdToY(currentPoolUsd);

  const areaPath = buildAreaPath();
  const linePath = buildLinePath();

  return (
    <div className="border-border rounded border p-4">
      <h3 className="text-foreground text-sm font-bold mb-1">
        FDV Milestone Chart
      </h3>
      <p className="text-muted text-[10px] mb-3">
        Pool unlock curve across FDV milestones &middot; FDV = PLOT price &times; {MAX_SUPPLY.toLocaleString()} max supply
      </p>

      <div className="w-full overflow-x-auto -mx-1 px-1">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-auto"
          style={{ minWidth: 320 }}
        >
          <defs>
            <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B4513" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#8B4513" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Y-axis grid lines */}
          {Y_TICKS.map((val) => (
            <g key={val}>
              <line
                x1={PAD.left}
                y1={usdToY(val)}
                x2={PAD.left + CHART_W}
                y2={usdToY(val)}
                stroke="#D4C5B0"
                strokeWidth={0.5}
                strokeDasharray={val === 0 ? "0" : "3,3"}
              />
              <text
                x={PAD.left - 6}
                y={usdToY(val) + 3}
                textAnchor="end"
                fill="#8B7355"
                fontSize={9}
                fontFamily="Inter, system-ui, sans-serif"
              >
                {val === 0 ? "$0" : `$${(val / 1_000_000).toFixed(1)}M`}
              </text>
            </g>
          ))}

          {/* Filled area */}
          <path d={areaPath} fill="url(#area-grad)" />

          {/* Step line */}
          <path
            d={linePath}
            fill="none"
            stroke="#8B4513"
            strokeWidth={2}
          />

          {/* Vertical zone dividers + annotations */}
          {CHART_MILESTONES.map((m) => {
            const x = fdvToX(m.fdv);
            const y = usdToY(m.poolUsd);
            return (
              <g key={m.label}>
                {/* Vertical divider */}
                <line
                  x1={x}
                  y1={PAD.top}
                  x2={x}
                  y2={PAD.top + CHART_H}
                  stroke="#D4C5B0"
                  strokeWidth={0.5}
                  strokeDasharray="4,3"
                />
                {/* Annotation at top of zone */}
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
                  {m.poolPct}% (${m.poolUsd >= 1_000_000 ? `${(m.poolUsd / 1_000_000).toFixed(1)}M` : `${(m.poolUsd / 1_000).toFixed(0)}K`})
                </text>
                {/* Dot at step corner */}
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
          {CHART_MILESTONES.map((m) => (
            <text
              key={m.label}
              x={fdvToX(m.fdv)}
              y={PAD.top + CHART_H + 14}
              textAnchor="middle"
              fill="#8B7355"
              fontSize={9}
              fontFamily="Inter, system-ui, sans-serif"
            >
              ${m.fdv >= 1_000_000 ? `${m.fdv / 1_000_000}M` : `${m.fdv / 1_000}K`}
            </text>
          ))}

          {/* X-axis label */}
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

          {/* Y-axis label */}
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

          {/* Current FDV indicator */}
          {currentFdv > 0 && (
            <g>
              {/* Vertical dashed line from dot to x-axis */}
              <line
                x1={dotX}
                y1={dotY}
                x2={dotX}
                y2={PAD.top + CHART_H}
                stroke="#8B4513"
                strokeWidth={1}
                strokeDasharray="3,3"
                opacity={0.6}
              />
              {/* Pulse ring */}
              <circle
                cx={dotX}
                cy={dotY}
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
              {/* Heartbeat dot */}
              <circle cx={dotX} cy={dotY} r={4} fill="#8B4513">
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
        {currentFdv > 0 && currentZone < CHART_MILESTONES.length && (
          <div className="text-muted text-[10px]">
            Next: {CHART_MILESTONES[currentZone].emoji} {CHART_MILESTONES[currentZone].label} at{" "}
            {formatUsdValue(CHART_MILESTONES[currentZone].fdv)} FDV
          </div>
        )}
      </div>
    </div>
  );
}
