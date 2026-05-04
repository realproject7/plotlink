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

const Y_FLOOR = 1_000; // $1K minimum for log scale

/** Map MCap → 0–1 on log Y scale (inverted: 0 = top, 1 = bottom) */
function mcapToY(mcap: number, yMin: number, yMax: number): number {
  if (mcap <= 0) return 1;
  const logMin = Math.log10(yMin);
  const logMax = Math.log10(yMax);
  const clamped = Math.min(Math.max(mcap, yMin), yMax);
  return 1 - (Math.log10(clamped) - logMin) / (logMax - logMin);
}

/** Map date → 0–1 on X (time) axis */
function dateToX(date: Date, start: Date, end: Date): number {
  const range = end.getTime() - start.getTime();
  if (range <= 0) return 0;
  return Math.min(1, Math.max(0, (date.getTime() - start.getTime()) / range));
}

function formatMcap(n: number): string {
  if (n >= 1_000_000) return `$${n / 1_000_000}M`;
  if (n >= 1_000) return `$${n / 1_000}K`;
  return `$${n}`;
}

interface DailyPrice { date: string; fdv: number }

/** CMC ranks only apply at specific production milestone values */
const MILESTONE_EXTRA: Record<string, { letter: string }> = {
  bronze: { letter: "A" },
  silver: { letter: "B" },
  gold: { letter: "C" },
  diamond: { letter: "D" },
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

/* ─── MCap Time-Series Chart ─── */

function MCapChart({
  currentFdv,
  campaignStart,
  campaignEnd,
  milestones,
}: {
  currentFdv: number;
  campaignStart: string;
  campaignEnd: string;
  milestones: StatusData["milestones"];
}) {
  const { data: history } = useQuery<DailyPrice[]>({
    queryKey: ["airdrop-daily-prices"],
    queryFn: async () => {
      const res = await fetch("/api/airdrop/daily-prices");
      if (!res.ok) throw new Error("Failed to fetch daily prices");
      return res.json();
    },
    staleTime: 300_000,
  });

  const start = new Date(campaignStart + "T00:00:00Z");
  const end = new Date(campaignEnd + "T00:00:00Z");
  const now = new Date();

  const svgW = 600;
  const svgH = 200;
  const pad = { top: 10, right: 10, bottom: 24, left: 10 };
  const chartW = svgW - pad.left - pad.right;
  const chartH = svgH - pad.top - pad.bottom;

  // Milestone entries — derive labels from config values, cmcRank only for matching prod values
  const milestoneEntries = Object.entries(milestones).map(([key, val]) => {
    const extra = MILESTONE_EXTRA[key] ?? { letter: key[0].toUpperCase() };
    return {
      key,
      ...val,
      label: formatMcap(val.mcap),
      cmcRank: CMC_RANKS[val.mcap] ?? "",
      letter: extra.letter,
    };
  });

  // Y-axis domain: floor to diamond milestone (config-driven)
  const yMax = milestones.diamond.mcap;
  const yMin = Math.min(Y_FLOOR, yMax / 1000);

  // X/Y coordinate helpers (within chart area)
  const toX = (d: Date) => pad.left + dateToX(d, start, end) * chartW;
  const toY = (mcap: number) => pad.top + mcapToY(mcap, yMin, yMax) * chartH;

  // Historical line path + area fill
  const points = (history ?? []).map((p) => ({
    x: toX(new Date(p.date)),
    y: toY(p.fdv),
  }));
  const linePath = points.length > 0
    ? points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
    : "";
  const areaPath = points.length > 0
    ? `${linePath} L${points[points.length - 1].x},${pad.top + chartH} L${points[0].x},${pad.top + chartH} Z`
    : "";

  // Projection line: start FDV → diamond milestone at campaign end
  const startFdv = history && history.length > 0 ? history[0].fdv : currentFdv;
  const projX1 = toX(start);
  const projY1 = toY(startFdv > 0 ? startFdv : yMin);
  const projX2 = toX(end);
  const projY2 = toY(yMax);

  // Current dot position
  const dotX = toX(now);
  const dotY = toY(currentFdv > 0 ? currentFdv : yMin);

  // X-axis time ticks
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
  const tickInterval = totalDays <= 14 ? 1 : totalDays <= 60 ? 7 : 30;
  const xTicks: Date[] = [];
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + tickInterval * 86_400_000)) {
    xTicks.push(new Date(d));
  }

  // Y-axis ticks at milestone values + floor
  const yTicks = [yMin, ...milestoneEntries.map((m) => m.mcap)];

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full"
        style={{ minHeight: 160 }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`MCap time-series chart: current $${currentFdv > 0 ? (currentFdv / 1_000).toFixed(0) + "K" : "0"}`}
      >
        <defs>
          <linearGradient id="mcap-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Chart background */}
        <rect
          x={pad.left}
          y={pad.top}
          width={chartW}
          height={chartH}
          fill="rgba(255,255,255,0.02)"
          rx={4}
        />

        {/* Milestone horizontal dashed lines */}
        {milestoneEntries.map((ms) => {
          const y = toY(ms.mcap);
          return (
            <g key={ms.key}>
              <line
                x1={pad.left}
                y1={y}
                x2={pad.left + chartW}
                y2={y}
                stroke="var(--accent)"
                strokeWidth={0.75}
                strokeDasharray="4 3"
                opacity={0.5}
              />
              {/* Right-edge label — desktop only */}
              <text
                x={pad.left + chartW - 4}
                y={y - 4}
                textAnchor="end"
                fill="var(--accent)"
                fontSize={9}
                fontFamily="monospace"
                opacity={0.6}
                className="hidden sm:block"
              >
                {ms.label} — unlocks {ms.pct}%{ms.cmcRank ? ` (${ms.cmcRank})` : ""}
              </text>
            </g>
          );
        })}

        {/* Projection line (dashed) */}
        <line
          x1={projX1}
          y1={projY1}
          x2={projX2}
          y2={projY2}
          stroke="var(--accent-dim)"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          opacity={0.6}
        />

        {/* Historical area fill */}
        {areaPath && (
          <path d={areaPath} fill="url(#mcap-area-fill)" />
        )}

        {/* Historical line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
          />
        )}

        {/* Current MCap heartbeat dot */}
        <circle cx={dotX} cy={dotY} r={6} fill="var(--accent)" opacity={0.75}>
          <animate attributeName="r" values="6;12;6" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.75;0;0.75" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <circle cx={dotX} cy={dotY} r={4} fill="var(--accent)" />

        {/* X-axis time ticks */}
        {xTicks.map((d, i) => {
          const x = toX(d);
          const label = totalDays <= 60
            ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
            : d.toLocaleString("en", { month: "short", timeZone: "UTC" });
          // Show every other label if crowded
          const showLabel = totalDays <= 14 || i % 2 === 0;
          return (
            <g key={i}>
              <line
                x1={x} y1={pad.top + chartH}
                x2={x} y2={pad.top + chartH + 4}
                stroke="var(--color-muted)" strokeWidth={0.5}
              />
              {showLabel && (
                <text
                  x={x}
                  y={svgH - 4}
                  textAnchor="middle"
                  fill="var(--color-muted)"
                  fontSize={8}
                  fontFamily="monospace"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}

        {/* Y-axis labels — desktop only */}
        {yTicks.map((mcap) => (
          <text
            key={mcap}
            x={pad.left + 4}
            y={toY(mcap) - 3}
            fill="var(--color-muted)"
            fontSize={8}
            fontFamily="monospace"
            className="hidden sm:block"
          >
            {formatMcap(mcap)}
          </text>
        ))}
      </svg>

      {/* Mobile milestone legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:hidden">
        {milestoneEntries.map((ms) => (
          <div key={ms.key} className="flex gap-2">
            <span className="text-xs font-bold text-muted font-mono">{ms.letter}</span>
            <div>
              <div className="text-sm font-bold text-foreground">{ms.label}</div>
              <div className="text-sm font-bold text-foreground">unlocks {ms.pct}%</div>
              <div className="text-xs text-muted">{ms.cmcRank}</div>
            </div>
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

      {/* ── MCap time-series chart ── */}
      <MCapChart
        currentFdv={data.currentFdv}
        campaignStart={data.campaignStart}
        campaignEnd={data.campaignEnd}
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
