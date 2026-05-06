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
 * Maps MCap → 0–1 X position with milestones at fixed positions
 * (0/0.25/0.5/0.75/1.0). Uses monotone cubic Hermite interpolation in
 * (log10(mcap), X) space, with Catmull-Rom slopes at each knot, so the
 * function is C¹-continuous everywhere — no slope discontinuities at
 * milestone boundaries (which cause visible kinks in the rendered curve).
 */
function makeMcapToX(milestones: StatusData["milestones"]) {
  const lms = [
    Math.log10(milestones.bronze.mcap / 100),
    Math.log10(milestones.bronze.mcap),
    Math.log10(milestones.silver.mcap),
    Math.log10(milestones.gold.mcap),
    Math.log10(milestones.diamond.mcap),
  ];
  const xs = [0, 0.25, 0.5, 0.75, 1.0];

  // Catmull-Rom slopes (centered diff interior, one-sided at ends)
  const slopes = lms.map((_, i) => {
    if (i === 0) return (xs[1] - xs[0]) / (lms[1] - lms[0]);
    if (i === lms.length - 1) return (xs[i] - xs[i - 1]) / (lms[i] - lms[i - 1]);
    return (xs[i + 1] - xs[i - 1]) / (lms[i + 1] - lms[i - 1]);
  });

  return (mcap: number): number => {
    if (mcap <= 0) return 0;
    const t = Math.log10(mcap);
    if (t <= lms[0]) return 0;
    if (t >= lms[lms.length - 1]) return 1;

    let i = 1;
    while (i < lms.length && t > lms[i]) i++;

    const t0 = lms[i - 1], t1 = lms[i];
    const x0 = xs[i - 1], x1 = xs[i];
    const m0 = slopes[i - 1], m1 = slopes[i];
    const dt = t1 - t0;
    const u = (t - t0) / dt;
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    return h00 * x0 + h10 * dt * m0 + h01 * x1 + h11 * dt * m1;
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
  const mcapToX = makeMcapToX(milestones);

  // SVG geometry — area chart, no label space above (labels are inside)
  const svgW = 600;
  const svgH = 240;
  const pad = { top: 14, right: 16, bottom: 14, left: 48 };
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
      milestoneNum: idx + 1,
      pos: positions[idx] ?? 1,
    };
  });

  // Y-axis: linear, $0 → diamond. 5 evenly-spaced ticks.
  const yMax = milestones.diamond.mcap;
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map((f) => f * yMax);
  const toX = (xFrac: number) => pad.left + xFrac * chartW;
  const toY = (mcap: number) => pad.top + (1 - Math.min(1, Math.max(0, mcap / yMax))) * chartH;

  // Smooth curve: sample 200 points across full log range. Because mcapToX
  // is C¹-smooth (Catmull-Rom Hermite), the curve has no slope discontinuities
  // at milestone knots. Heartbeat dot lies exactly on the curve.
  const lmStart = Math.log10(milestones.bronze.mcap / 100);
  const lmEnd = Math.log10(milestones.diamond.mcap);
  const numSamples = 200;
  const curve: { x: number; y: number }[] = [{ x: toX(0), y: toY(0) }];
  for (let s = 1; s <= numSamples; s++) {
    const m = Math.pow(10, lmStart + (lmEnd - lmStart) * (s / numSamples));
    curve.push({ x: toX(mcapToX(m)), y: toY(m) });
  }
  const linePath = curve.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${curve[curve.length - 1].x},${pad.top + chartH} L${curve[0].x},${pad.top + chartH} Z`;

  // Current MCap dot
  const dotMcap = currentFdv > 0 ? currentFdv : 0;
  const dotX = toX(mcapToX(dotMcap));
  const dotY = toY(dotMcap);

  return (
    <div className="space-y-2">
      <div className="bg-surface-raised rounded-[var(--card-radius)] border border-border p-3">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full font-mono"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`MCap area chart: current ${formatMcap(currentFdv)} of ${formatMcap(yMax)}`}
        >
          <defs>
            <linearGradient id="mcap-area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--dist)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--dist)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Y-axis tick gridlines */}
          {yTicks.map((tick) => {
            const y = toY(tick);
            return (
              <line key={`grid-${tick}`} x1={pad.left} y1={y} x2={pad.left + chartW} y2={y} stroke="var(--border)" strokeWidth={0.5} />
            );
          })}

          {/* Milestone column backgrounds — reached=dist, unreached=burn(faded) */}
          {milestoneEntries.map((ms, idx) => {
            const x0 = toX(idx === 0 ? 0 : milestoneEntries[idx - 1].pos);
            const x1 = toX(ms.pos);
            return (
              <rect
                key={`col-${ms.key}`}
                x={x0}
                y={pad.top}
                width={x1 - x0}
                height={chartH}
                fill={ms.reached ? "var(--dist)" : "var(--burn)"}
                opacity={ms.reached ? 0.08 : 0.04}
              />
            );
          })}

          {/* Vertical band dividers */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const x = toX(frac);
            const isEdge = frac === 0 || frac === 1;
            return (
              <line key={`band-${frac}`} x1={x} y1={pad.top} x2={x} y2={pad.top + chartH} stroke="var(--border)" strokeWidth={isEdge ? 0.75 : 0.5} />
            );
          })}

          {/* Y-axis tick labels (left) */}
          {yTicks.map((tick) => {
            const y = toY(tick);
            return (
              <text key={`ytick-${tick}`} x={pad.left - 6} y={y + 3} textAnchor="end" fill="var(--muted)" fontSize={9}>
                {formatMcap(tick)}
              </text>
            );
          })}

          {/* Area fill below curve */}
          <path d={areaPath} fill="url(#mcap-area-fill)" />

          {/* Curve line */}
          <path d={linePath} fill="none" stroke="var(--dist)" strokeWidth={2} />

          {/* Milestone label blocks — inside chart, anchored to LEFT of each vertical line */}
          <g className="hidden sm:block">
            {milestoneEntries.map((ms) => {
              const lineX = toX(ms.pos);
              const labelX = lineX - 6;
              const top = pad.top + 14;
              const color = ms.reached ? "var(--dist)" : "var(--accent)";
              return (
                <g key={`label-${ms.key}`}>
                  <text x={labelX} y={top} textAnchor="end" fill={color} fontSize={10} fontWeight="bold" style={{ letterSpacing: "0.18em" }}>
                    MILESTONE {ms.milestoneNum}
                  </text>
                  <text x={labelX} y={top + 16} textAnchor="end" fill={color} fontSize={13} fontWeight="bold">
                    {ms.label}
                  </text>
                  <text x={labelX} y={top + 30} textAnchor="end" fill={color} fontSize={10} opacity={0.85}>
                    unlocks {ms.pct}%
                  </text>
                  {ms.cmcRank && (
                    <text x={labelX} y={top + 43} textAnchor="end" fill={color} fontSize={9} opacity={0.55}>
                      CMC {ms.cmcRank}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Heartbeat dot at current MCap */}
          <circle cx={dotX} cy={dotY} r={6} fill="var(--accent)" opacity={0.75}>
            <animate attributeName="r" values="6;12;6" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.75;0;0.75" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx={dotX} cy={dotY} r={4} fill="var(--accent)" />

          {/* Current MCap caption right above the dot */}
          <text x={dotX} y={dotY - 12} textAnchor="middle" fill="var(--accent)" fontSize={10} fontWeight="bold">
            {formatMcap(currentFdv)}
          </text>
        </svg>
      </div>

      {/* Mobile milestone legend — Mn / value / pct in 4 columns */}
      <div className="grid grid-cols-4 gap-1 sm:hidden font-mono">
        {milestoneEntries.map((ms) => (
          <div key={ms.key} className="text-center">
            <div className={`text-[10px] font-bold uppercase tracking-wider ${ms.reached ? "text-[var(--dist)]" : "text-foreground"}`}>
              M{ms.milestoneNum}
            </div>
            <div className="text-[10px] text-muted">{ms.label}</div>
            <div className="text-[10px] text-muted">{ms.pct}%</div>
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
      <div className="bg-surface rounded-[var(--card-radius)] border border-border p-4">
        <div className="text-muted text-sm">Loading campaign status...</div>
      </div>
    );
  }

  const pad2 = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="bg-surface rounded-[var(--card-radius)] border border-border p-5 space-y-6">
      {/* ── Bold headline ── */}
      <div className="text-center space-y-2">
        <h2 className="font-heading text-foreground text-3xl sm:text-[48px] font-bold leading-[1.1] tracking-tight">
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
              <div className="bg-surface-raised rounded-[var(--card-radius)] border border-border px-3 py-2 text-center min-w-[56px]">
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
        MCap = PLOT price × 1M max supply · CMC = CoinMarketCap
      </div>

      {/* ── How It Works modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={closeModal}
        >
          <div
            className="bg-surface border-border rounded-[var(--card-radius)] border p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-5 relative"
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
              MCap = PLOT price × 1M max supply · CMC = CoinMarketCap
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
