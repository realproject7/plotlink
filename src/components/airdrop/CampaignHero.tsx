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

const MILESTONE_CARDS = [
  { mcap: 1_000_000, label: "$1M", cmcRank: "#1900", pct: 10, key: "bronze" as const },
  { mcap: 10_000_000, label: "$10M", cmcRank: "#950", pct: 30, key: "silver" as const },
  { mcap: 50_000_000, label: "$50M", cmcRank: "#400", pct: 50, key: "gold" as const },
  { mcap: 100_000_000, label: "$100M", cmcRank: "#250", pct: 100, key: "diamond" as const },
];

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

      {/* ── Milestone cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {MILESTONE_CARDS.map((ms) => {
          const reached = data.currentFdv >= ms.mcap;
          return (
            <div
              key={ms.key}
              className={`rounded border px-3 py-3 space-y-1.5 ${
                reached ? "border-accent" : "border-border opacity-60"
              }`}
            >
              <div className="text-sm">
                {reached ? (
                  <span className="text-accent">&#x2705;</span>
                ) : (
                  <span className="text-muted">&#x25CB;</span>
                )}
              </div>
              <div className={`text-sm font-bold text-center ${reached ? "text-accent" : "text-foreground"}`}>
                {ms.label}
              </div>
              <div className="text-muted text-[10px] text-center">
                ≈ CMC {ms.cmcRank}
              </div>
              <div className="text-muted text-[10px] text-center">unlocks</div>
              <div className={`text-xs font-bold text-center ${reached ? "text-accent" : "text-foreground"}`}>
                {ms.pct}%
              </div>
            </div>
          );
        })}
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
