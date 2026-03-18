"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address, parseUnits, formatUnits } from "viem";
import { publicClient } from "../../lib/rpc";
import { mcv2BondAbi } from "../../lib/price";
import { MCV2_BOND, IS_TESTNET } from "../../lib/contracts/constants";

const CHART_W = 320;
const CHART_H = 140;
const PAD = { top: 10, right: 10, bottom: 24, left: 48 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;
const NUM_POINTS = 20;

interface PriceChartProps {
  tokenAddress: Address;
  totalSupplyRaw: bigint;
  currentPriceRaw: bigint;
}

/**
 * Lightweight bonding curve chart.
 *
 * Samples getReserveForToken at evenly spaced supply points to plot
 * the price curve, then marks the current supply position.
 */
export function PriceChart({ tokenAddress, totalSupplyRaw, currentPriceRaw }: PriceChartProps) {
  const reserveLabel = IS_TESTNET ? "WETH" : "$PLOT";

  // Sample the bonding curve at multiple supply points
  const { data: curvePoints } = useQuery({
    queryKey: ["price-curve", tokenAddress],
    queryFn: async () => {
      // Sample from 1 token to 2x current supply (or a minimum of 100 tokens)
      const minMax = parseUnits("100", 18);
      const maxSupply =
        totalSupplyRaw * BigInt(2) > minMax
          ? totalSupplyRaw * BigInt(2)
          : minMax;

      const points: { supply: number; price: number }[] = [];
      const step = maxSupply / BigInt(NUM_POINTS);
      if (step === BigInt(0)) return [];

      // Query cumulative costs for increasing mint amounts from current supply
      const promises: Promise<bigint>[] = [];
      for (let i = 1; i <= NUM_POINTS; i++) {
        const amount = step * BigInt(i);
        promises.push(
          publicClient
            .readContract({
              address: MCV2_BOND,
              abi: mcv2BondAbi,
              functionName: "getReserveForToken",
              args: [tokenAddress, amount],
            })
            .then((r) => (r as readonly [bigint, bigint])[0])
            .catch(() => BigInt(0)),
        );
      }

      const cumulativeCosts = await Promise.all(promises);

      // Start with the actual current supply/price point
      const currentSupplyNum = Number(formatUnits(totalSupplyRaw, 18));
      const currentPriceNum = Number(formatUnits(currentPriceRaw, 18));
      points.push({ supply: currentSupplyNum, price: currentPriceNum });

      // Compute marginal price at each future supply step
      let prevCost = BigInt(0);
      for (let i = 0; i < cumulativeCosts.length; i++) {
        const amount = step * BigInt(i + 1);
        const marginalCost = cumulativeCosts[i] - prevCost;
        const pricePerToken =
          Number(formatUnits(marginalCost, 18)) /
          Number(formatUnits(step, 18));
        points.push({
          supply: currentSupplyNum + Number(formatUnits(amount, 18)),
          price: pricePerToken,
        });
        prevCost = cumulativeCosts[i];
      }
      return points;
    },
    staleTime: 60000,
  });

  if (!curvePoints || curvePoints.length === 0) return null;

  // Scale to chart coords
  const maxX = Math.max(...curvePoints.map((p) => p.supply));
  const maxY = Math.max(...curvePoints.map((p) => p.price));
  if (maxX === 0 || maxY === 0) return null;

  const scaleX = (v: number) => PAD.left + (v / maxX) * PLOT_W;
  const scaleY = (v: number) => PAD.top + PLOT_H - (v / maxY) * PLOT_H;

  // Build SVG polyline
  const linePoints = curvePoints
    .map((p) => `${scaleX(p.supply)},${scaleY(p.price)}`)
    .join(" ");

  // Current supply marker — uses actual current supply and price
  const currentSupply = Number(formatUnits(totalSupplyRaw, 18));
  const currentPrice = Number(formatUnits(currentPriceRaw, 18));
  const markerX = scaleX(currentSupply);
  const markerY = scaleY(currentPrice);

  // Y-axis labels (3 ticks)
  const yTicks = [0, maxY / 2, maxY];
  // X-axis labels
  const xTicks = [0, maxX / 2, maxX];

  return (
    <section className="border-border mt-4 rounded border px-4 py-4">
      <h2 className="text-foreground text-sm font-medium">Price Curve</h2>
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
            {v < 0.001 ? v.toExponential(0) : v.toFixed(4)}
          </text>
        ))}

        {/* X-axis labels */}
        {xTicks.map((v, i) => (
          <text
            key={`xl-${i}`}
            x={scaleX(v)}
            y={CHART_H - 4}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize={8}
            fontFamily="monospace"
          >
            {v < 1 ? v.toFixed(1) : Math.round(v).toLocaleString()}
          </text>
        ))}

        {/* Curve */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Current supply marker */}
        {currentSupply > 0 && (
          <>
            <line
              x1={markerX}
              y1={PAD.top}
              x2={markerX}
              y2={PAD.top + PLOT_H}
              stroke="var(--accent-dim)"
              strokeWidth={0.5}
              strokeDasharray="3,2"
            />
            <circle
              cx={markerX}
              cy={markerY}
              r={3}
              fill="var(--accent)"
            />
          </>
        )}
      </svg>
      <p className="text-muted mt-1 text-[10px]">
        Supply vs. price per token ({reserveLabel})
        {currentSupply > 0 && (
          <span className="text-accent-dim">
            {" "}
            &middot; current: {currentSupply.toLocaleString()} tokens
          </span>
        )}
      </p>
    </section>
  );
}
