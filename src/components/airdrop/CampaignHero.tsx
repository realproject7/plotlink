"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

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

/* ─── Chart helpers ─── */

/**
 * Piecewise-linear-banded X-axis: each of the 4 milestones occupies an equal
 * 25% band of chart width. Within a band, position is log-interpolated
 * between that band's lower and upper milestone values.
 *
 *   knot 0 = bronze / 100   →   0% (chart left, "$0")
 *   knot 1 = bronze         →  25%
 *   knot 2 = silver         →  50%
 *   knot 3 = gold           →  75%
 *   knot 4 = diamond        → 100% (chart right)
 *
 * Returns a fn that maps MCap → 0–1 (0 = left, 1 = right). Milestone
 * markers are 25% apart and cannot collide regardless of MCap ratios.
 */
function makeMcapToX(milestones: StatusData["milestones"]) {
  const knots = [
    milestones.bronze.mcap / 100,
    milestones.bronze.mcap,
    milestones.silver.mcap,
    milestones.gold.mcap,
    milestones.diamond.mcap,
  ];
  const zoneCount = knots.length - 1;
  return (mcap: number): number => {
    if (mcap <= knots[0]) return 0;
    if (mcap >= knots[knots.length - 1]) return 1;
    for (let i = 1; i < knots.length; i++) {
      if (mcap <= knots[i]) {
        const t =
          (Math.log10(mcap) - Math.log10(knots[i - 1])) /
          (Math.log10(knots[i]) - Math.log10(knots[i - 1]));
        return (i - 1 + t) / zoneCount;
      }
    }
    return 1;
  };
}

function formatMcap(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return Number.isInteger(m) ? `$${m}M` : `$${m.toFixed(2)}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return Number.isInteger(k) ? `$${k}K` : `$${k.toFixed(2)}K`;
  }
  return `$${n.toFixed(0)}`;
}

const TIER_NAMES: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

const CMC_RANKS: Record<number, string> = {
  1_000_000: "≈ #1900",
  10_000_000: "≈ #950",
  50_000_000: "≈ #400",
  100_000_000: "≈ #250",
};

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

/* ─── MCap Milestone Area Chart ─── */

function MCapChart({
  currentFdv,
  milestones,
}: {
  currentFdv: number;
  milestones: StatusData["milestones"];
}) {
  // Banded X-axis (each milestone gets equal 25% of chart width)
  const mcapToX = makeMcapToX(milestones);

  // SVG geometry — area chart with room for top labels and Y-axis ticks
  const svgW = 600;
  const svgH = 280;
  const pad = { top: 78, right: 16, bottom: 30, left: 48 };
  const chartW = svgW - pad.left - pad.right;
  const chartH = svgH - pad.top - pad.bottom;

  // Milestone entries — derive label/CMC rank from config so test/prod both work
  const milestoneEntries = Object.entries(milestones).map(([key, val], idx) => {
    const positions = [0.25, 0.5, 0.75, 1.0];
    return {
      key,
      ...val,
      label: formatMcap(val.mcap),
      cmcRank: CMC_RANKS[val.mcap] ?? "",
      tierName: TIER_NAMES[key] ?? key,
      pos: positions[idx] ?? 1,
    };
  });

  // Y-axis: linear, $0 → diamond. 5 evenly-spaced ticks at 0/25/50/75/100% of diamond.
  const yMax = milestones.diamond.mcap;
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map((f) => f * yMax);
  const toX = (xFrac: number) => pad.left + xFrac * chartW;
  const toY = (mcap: number) => pad.top + (1 - Math.min(1, Math.max(0, mcap / yMax))) * chartH;

  // Smooth curve: sample 20 points per band using the same banded log
  // interpolation as mcapToX, so the curve passes exactly through the
  // milestone knots and the heartbeat dot lies exactly on the curve.
  const knots = [
    milestones.bronze.mcap / 100,
    milestones.bronze.mcap,
    milestones.silver.mcap,
    milestones.gold.mcap,
    milestones.diamond.mcap,
  ];
  const curve: { x: number; y: number }[] = [{ x: toX(0), y: toY(0) }];
  for (let i = 1; i < knots.length; i++) {
    const lo = Math.log10(knots[i - 1]);
    const hi = Math.log10(knots[i]);
    const samples = 24;
    for (let s = 1; s <= samples; s++) {
      const m = Math.pow(10, lo + (hi - lo) * (s / samples));
      curve.push({ x: toX(mcapToX(m)), y: toY(m) });
    }
  }
  const linePath = curve.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${curve[curve.length - 1].x},${pad.top + chartH} L${curve[0].x},${pad.top + chartH} Z`;

  // Current MCap dot — clamp at floor so dot is always visible if currentFdv = 0
  const dotMcap = currentFdv > 0 ? currentFdv : 0;
  const dotX = toX(mcapToX(dotMcap));
  const dotY = toY(dotMcap);

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`MCap area chart: current ${formatMcap(currentFdv)} of ${formatMcap(yMax)}`}
      >
        <defs>
          <linearGradient id="mcap-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Y-axis tick gridlines (subtle) */}
        {yTicks.map((tick) => {
          const y = toY(tick);
          return (
            <line
              key={`grid-${tick}`}
              x1={pad.left}
              y1={y}
              x2={pad.left + chartW}
              y2={y}
              stroke="var(--accent)"
              strokeWidth={0.5}
              opacity={0.1}
            />
          );
        })}

        {/* Vertical band dividers — span full chart height (3 inner + 2 edges) */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const x = toX(frac);
          const isEdge = frac === 0 || frac === 1;
          return (
            <line
              key={`band-${frac}`}
              x1={x}
              y1={pad.top}
              x2={x}
              y2={pad.top + chartH}
              stroke="var(--accent)"
              strokeWidth={isEdge ? 0.75 : 0.5}
              opacity={isEdge ? 0.5 : 0.35}
            />
          );
        })}

        {/* Top-of-band labels: TIER / $value / unlocks Y% / (≈ #Z), centered in each band column */}
        {milestoneEntries.map((ms, i) => {
          // Bronze owns band 0 (0-25%), Silver band 1 (25-50%), etc. Center = (i + 0.5) / 4.
          const cx = toX((i + 0.5) / 4);
          return (
            <g key={`top-${ms.key}`} className="hidden sm:block">
              <text x={cx} y={pad.top - 56} textAnchor="middle" fill="var(--accent)" fontSize={11} fontFamily="monospace" fontWeight="bold" letterSpacing="2">
                {ms.tierName.toUpperCase()}
              </text>
              <text x={cx} y={pad.top - 40} textAnchor="middle" fill="var(--accent)" fontSize={13} fontFamily="monospace" fontWeight="bold">
                {ms.label}
              </text>
              <text x={cx} y={pad.top - 25} textAnchor="middle" fill="var(--accent)" fontSize={10} fontFamily="monospace" opacity={0.85}>
                unlocks {ms.pct}%
              </text>
              {ms.cmcRank && (
                <text x={cx} y={pad.top - 11} textAnchor="middle" fill="var(--accent)" fontSize={9} fontFamily="monospace" opacity={0.55}>
                  {ms.cmcRank}
                </text>
              )}
            </g>
          );
        })}

        {/* Y-axis tick labels on the left */}
        {yTicks.map((tick) => {
          const y = toY(tick);
          return (
            <text
              key={`ytick-${tick}`}
              x={pad.left - 6}
              y={y + 3}
              textAnchor="end"
              fill="var(--color-muted)"
              fontSize={9}
              fontFamily="monospace"
            >
              {formatMcap(tick)}
            </text>
          );
        })}

        {/* Area fill below curve */}
        <path d={areaPath} fill="url(#mcap-area-fill)" />

        {/* Curve line */}
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} />

        {/* Heartbeat dot at current MCap (always lies on curve by construction) */}
        <circle cx={dotX} cy={dotY} r={6} fill="var(--accent)" opacity={0.75}>
          <animate attributeName="r" values="6;12;6" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.75;0;0.75" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <circle cx={dotX} cy={dotY} r={4} fill="var(--accent)" />

        {/* Bottom tier-name labels under each band (desktop only) */}
        {milestoneEntries.map((ms, i) => {
          const cx = toX((i + 0.5) / 4);
          return (
            <text
              key={`bot-${ms.key}`}
              x={cx}
              y={pad.top + chartH + 16}
              textAnchor="middle"
              fill="var(--color-muted)"
              fontSize={10}
              fontFamily="monospace"
              letterSpacing="1.5"
              className="hidden sm:block"
            >
              {ms.tierName.toLowerCase()}
            </text>
          );
        })}

        {/* Current MCap caption right above the dot */}
        <text
          x={dotX}
          y={dotY - 12}
          textAnchor="middle"
          fill="var(--accent)"
          fontSize={10}
          fontFamily="monospace"
          fontWeight="bold"
        >
          {formatMcap(currentFdv)}
        </text>
      </svg>

      {/* Mobile milestone legend — tier name + value + unlock% in 4 columns under chart */}
      <div className="grid grid-cols-4 gap-1 sm:hidden">
        {milestoneEntries.map((ms) => (
          <div key={ms.key} className="text-center">
            <div className="text-[10px] font-bold text-foreground uppercase tracking-wider">
              {ms.tierName}
            </div>
            <div className="text-[10px] text-muted font-mono">{ms.label}</div>
            <div className="text-[10px] text-muted font-mono">{ms.pct}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main component ─── */

export function CampaignHero() {
  const { data, isLoading } = useAirdropStatus();
  const countdown = useCountdown(data?.campaignEnd ?? "2027-01-01");
  const [showModal, setShowModal] = useState(false);

  const closeModal = useCallback(() => setShowModal(false), []);

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
          PLOT BIG AIRDROP
        </h2>
        <p className="text-muted text-sm sm:text-base leading-relaxed max-w-md mx-auto">
          When PLOT MCap reaches each milestone, the airdrop pool gets bigger.{" "}
          If not,{" "}
          {data.lockerTx ? (
            <a
              href={`https://basescan.org/tx/${data.lockerTx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              locked
            </a>
          ) : (
            "locked"
          )}{" "}
          tokens will be burned.
        </p>
      </div>

      {/* ── Modal trigger ── */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="text-accent text-xs hover:underline cursor-pointer"
        >
          How does this work? &rarr;
        </button>
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

      {/* ── MCap milestone progression chart ── */}
      <MCapChart
        currentFdv={data.currentFdv}
        milestones={data.milestones}
      />

      {/* ── MCap explanation footnote ── */}
      <div className="text-center text-muted text-[10px]">
        MCap = PLOT price × 1M max supply
      </div>

      {/* ── How It Works modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-background border-border rounded border p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-5 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-3 right-3 text-muted hover:text-foreground text-lg leading-none cursor-pointer"
            >
              &times;
            </button>

            <h3 className="text-foreground text-base font-bold uppercase tracking-wider text-center">
              How does this work?
            </h3>

            {/* Section 1 */}
            <div className="space-y-2">
              <div className="text-muted text-[10px] font-bold uppercase tracking-widest font-mono">
                ── 1. The Airdrop Pool ──
              </div>
              <p className="text-muted text-xs leading-relaxed font-mono">
                50,000 PLOT (5% of max supply) is locked in a time-locked contract.
                After 6 months, the pool is either distributed to point holders or
                burned forever. No team keeps it. No treasury recycles it.
              </p>
            </div>

            {/* Section 2 */}
            <div className="space-y-2">
              <div className="text-muted text-[10px] font-bold uppercase tracking-widest font-mono">
                ── 2. Milestones &amp; Pool Size ──
              </div>
              <p className="text-muted text-xs leading-relaxed font-mono">
                The pool distribution depends on PLOT MCap:
              </p>
              <div className="space-y-1 text-xs font-mono">
                <div><span className="text-foreground">MCap $1M</span> <span className="text-muted">&rarr; 10% unlocked (5,000 PLOT)</span></div>
                <div><span className="text-foreground">MCap $10M</span> <span className="text-muted">&rarr; 30% unlocked (15,000 PLOT)</span></div>
                <div><span className="text-foreground">MCap $50M</span> <span className="text-muted">&rarr; 50% unlocked (25,000 PLOT)</span></div>
                <div><span className="text-foreground">MCap $100M</span> <span className="text-muted">&rarr; 100% unlocked (50,000 PLOT)</span></div>
              </div>
              <p className="text-muted text-xs leading-relaxed font-mono">
                The remaining % is burned permanently. Higher MCap = bigger pool AND
                higher per-PLOT value. Double benefit.
              </p>
            </div>

            {/* Section 3 */}
            <div className="space-y-2">
              <div className="text-muted text-[10px] font-bold uppercase tracking-widest font-mono">
                ── 3. How to Earn PL Points ──
              </div>
              <p className="text-muted text-xs leading-relaxed font-mono">
                Your share of the pool is based on PL points:
              </p>
              <div className="space-y-1 text-xs font-mono text-muted">
                <div>&bull; Buy story tokens &rarr; 1 PL per PLOT spent</div>
                <div>&bull; Refer friends &rarr; 20% of their points</div>
                <div>&bull; Publish a story &rarr; 50 PL (flat)</div>
                <div>&bull; Rate a story &rarr; 5 PL (max 10/day)</div>
              </div>
            </div>

            {/* Section 4 */}
            <div className="space-y-2">
              <div className="text-muted text-[10px] font-bold uppercase tracking-widest font-mono">
                ── 4. Streak Boost ──
              </div>
              <p className="text-muted text-xs leading-relaxed font-mono">
                Daily check-in builds streaks. Longer streak = higher boost on all points earned:
              </p>
              <div className="text-xs font-mono text-muted">
                <span className="text-foreground">7d</span> +5% &nbsp;| <span className="text-foreground">&nbsp;14d</span> +10% &nbsp;| <span className="text-foreground">&nbsp;30d</span> +20% &nbsp;| <span className="text-foreground">&nbsp;50d</span> +30% &nbsp;| <span className="text-foreground">&nbsp;100d</span> +50%
              </div>
              <p className="text-muted text-xs leading-relaxed font-mono">
                Miss a day &rarr; drop one tier.
              </p>
            </div>

            {/* Section 5 */}
            <div className="space-y-3">
              <div className="text-muted text-[10px] font-bold uppercase tracking-widest font-mono">
                ── 5. Why Is This Different? ──
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded border border-border text-muted opacity-50 px-4 py-3 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider font-mono text-center">
                    TYPICAL AIRDROP
                  </div>
                  <div className="space-y-1.5 text-xs text-center font-mono">
                    <div>Fixed amount</div>
                    <div>Dumps on day 1</div>
                    <div>No skin in game</div>
                  </div>
                </div>
                <div className="rounded border border-accent text-foreground px-4 py-3 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider font-mono text-center">
                    THIS AIRDROP
                  </div>
                  <div className="space-y-1.5 text-xs text-center font-mono">
                    <div>Pool grows with MCap</div>
                    <div>Burned if no growth</div>
                    <div>Everyone wins together</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footnote */}
            <div className="text-center text-muted text-[10px] font-mono">
              MCap = PLOT price × 1M max supply
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
