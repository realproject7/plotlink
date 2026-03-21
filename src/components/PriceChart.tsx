"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address, formatUnits } from "viem";
import { supabase } from "../../lib/supabase";
import { RESERVE_LABEL } from "../../lib/contracts/constants";

const CHART_W = 320;
const CHART_H = 140;
const PAD = { top: 10, right: 10, bottom: 24, left: 48 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;
const MAX_POINTS = 50;

interface PriceChartProps {
  tokenAddress: Address;
  currentPriceRaw: bigint;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 1) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatPrice(v: number): string {
  if (v === 0) return "0";
  if (v < 0.001) return v.toExponential(0);
  if (v < 1) return v.toFixed(4);
  return v.toFixed(2);
}

export function PriceChart({ tokenAddress, currentPriceRaw }: PriceChartProps) {
  const currentPrice = Number(formatUnits(currentPriceRaw, 18));

  const { data: tradePoints } = useQuery({
    queryKey: ["price-history", tokenAddress],
    queryFn: async () => {
      if (!supabase) return [];
      const { data } = await supabase
        .from("trade_history")
        .select("price_per_token, block_timestamp")
        .eq("token_address", tokenAddress.toLowerCase())
        .order("block_timestamp", { ascending: true });
      if (!data || data.length === 0) return [];

      // Downsample if too many points
      if (data.length <= MAX_POINTS) return data;
      const step = (data.length - 1) / (MAX_POINTS - 1);
      const sampled = [];
      for (let i = 0; i < MAX_POINTS; i++) {
        sampled.push(data[Math.round(i * step)]);
      }
      return sampled;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const hasData = tradePoints && tradePoints.length > 0;

  // Empty state
  if (!hasData) {
    return (
      <section className="border-border mt-4 rounded border px-4 py-4">
        <h2 className="text-foreground text-sm font-medium">Price</h2>
        <div className="mt-3 flex flex-col items-center justify-center py-6">
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="3" fill="var(--accent)" />
            <circle cx="20" cy="20" r="3" fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity="0.4">
              <animate attributeName="r" values="3;8" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </svg>
          <p className="text-muted mt-2 text-[10px]">No trading activity yet</p>
          {currentPrice > 0 && (
            <p className="text-accent mt-1 text-xs font-medium">
              {formatPrice(currentPrice)} {RESERVE_LABEL}
            </p>
          )}
        </div>
      </section>
    );
  }

  // Build points array (round to eliminate floating-point noise)
  const points = tradePoints.map((t) => ({
    time: t.block_timestamp,
    price: Math.round(Number(t.price_per_token) * 1e8) / 1e8,
  }));

  // Scale with minimum Y range to prevent micro-noise exaggeration
  const prices = points.map((p) => p.price);
  const minY = Math.min(...prices);
  const maxY = Math.max(...prices);
  const rawRange = maxY - minY;
  const minRange = maxY * 0.01;
  const yRange = Math.max(rawRange, minRange) || maxY || 1;
  const yPad = yRange * 0.1;

  const scaleX = (i: number) =>
    PAD.left + (i / (points.length - 1 || 1)) * PLOT_W;
  const scaleY = (v: number) =>
    PAD.top + PLOT_H - ((v - (minY - yPad)) / (yRange + yPad * 2)) * PLOT_H;

  const linePoints = points
    .map((p, i) => `${scaleX(i)},${scaleY(p.price)}`)
    .join(" ");

  // Last point for pulse marker
  const lastIdx = points.length - 1;
  const lastX = scaleX(lastIdx);
  const lastY = scaleY(points[lastIdx].price);

  // Y-axis ticks
  const yTicks = [minY, (minY + maxY) / 2, maxY];

  // X-axis time labels (first, mid, last) — deduplicated when indices overlap
  const xLabelCandidates = [
    { idx: 0, label: formatTime(points[0].time) },
    { idx: Math.floor(lastIdx / 2), label: formatTime(points[Math.floor(lastIdx / 2)].time) },
    { idx: lastIdx, label: formatTime(points[lastIdx].time) },
  ];
  const xLabels = xLabelCandidates.filter(
    (item, i, arr) => arr.findIndex((a) => a.idx === item.idx) === i,
  );

  return (
    <section className="border-border mt-4 rounded border px-4 py-4">
      <h2 className="text-foreground text-sm font-medium">Price</h2>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="mt-2 w-full"
        style={{ maxWidth: CHART_W }}
      >
        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <line
            key={`yg-${i}`}
            x1={PAD.left}
            y1={scaleY(v)}
            x2={CHART_W - PAD.right}
            y2={scaleY(v)}
            stroke="var(--border)"
            strokeWidth={0.5}
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((v, i) => (
          <text
            key={`yl-${i}`}
            x={PAD.left - 4}
            y={scaleY(v) + 3}
            textAnchor="end"
            fill="var(--text-muted)"
            fontSize={8}
            fontFamily="monospace"
          >
            {formatPrice(v)}
          </text>
        ))}

        {/* X-axis time labels */}
        {xLabels.map(({ idx, label }) => (
          <text
            key={`xl-${idx}`}
            x={scaleX(idx)}
            y={CHART_H - 4}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize={8}
            fontFamily="monospace"
          >
            {label}
          </text>
        ))}

        {/* Price line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Current price pulse marker */}
        <circle
          cx={lastX}
          cy={lastY}
          r={3}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          opacity={0.4}
        >
          <animate attributeName="r" values="3;8" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <circle cx={lastX} cy={lastY} r={3} fill="var(--accent)" />
      </svg>
      <p className="text-muted mt-1 text-[10px]">
        Price per token ({RESERVE_LABEL})
        <span className="text-accent-dim">
          {" "}&middot; latest: {formatPrice(points[lastIdx].price)} {RESERVE_LABEL}
        </span>
      </p>
    </section>
  );
}
