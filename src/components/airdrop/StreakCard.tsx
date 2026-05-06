"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";

/* ─── Types ─── */

interface StreakData {
  currentStreak: number;
  boostPercent: number;
  nextTier: { days: number; boost: number } | null;
  checkedInToday: boolean;
  lastCheckin: string | null;
}

/* ─── Boost tier definitions ─── */

const BOOST_TIERS = [
  { days: 7, boost: 5 },
  { days: 14, boost: 10 },
  { days: 30, boost: 20 },
  { days: 50, boost: 30 },
  { days: 100, boost: 50 },
] as const;

/* ─── Weekly calendar helpers ─── */

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type DayStatus = "checked" | "today-checked" | "today-pending" | "missed" | "future";

function getWeekDays(
  currentStreak: number,
  checkedInToday: boolean,
  lastCheckin: string | null,
): DayStatus[] {
  const now = new Date();
  const todayDow = now.getUTCDay();
  const mondayOffset = todayDow === 0 ? -6 : 1 - todayDow;
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() + mondayOffset);
  monday.setUTCHours(0, 0, 0, 0);

  const todayStr = now.toISOString().slice(0, 10);
  const lastCheckinStr = lastCheckin ? new Date(lastCheckin).toISOString().slice(0, 10) : null;

  const checkedDates = new Set<string>();
  if (lastCheckinStr && currentStreak > 0) {
    const lastDate = new Date(lastCheckinStr + "T00:00:00Z");
    for (let i = 0; i < currentStreak; i++) {
      const d = new Date(lastDate);
      d.setUTCDate(d.getUTCDate() - i);
      const ds = d.toISOString().slice(0, 10);
      if (d >= monday) checkedDates.add(ds);
      else break;
    }
  }

  const result: DayStatus[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    const ds = d.toISOString().slice(0, 10);

    if (ds === todayStr) {
      result.push(checkedInToday ? "today-checked" : "today-pending");
    } else if (ds > todayStr) {
      result.push("future");
    } else if (checkedDates.has(ds)) {
      result.push("checked");
    } else {
      result.push("missed");
    }
  }
  return result;
}

/* ─── Tiers tooltip ─── */

function TiersTooltip({ currentStreak }: { currentStreak: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-muted hover:text-foreground text-[10px] cursor-pointer"
      >
        tiers &#9432;
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 bg-surface border-border border rounded p-2.5 shadow-sm min-w-[180px]">
          <div className="space-y-0.5">
            {BOOST_TIERS.map((tier) => {
              const unlocked = currentStreak >= tier.days;
              return (
                <div
                  key={tier.days}
                  className={`flex items-center justify-between text-[11px] ${
                    unlocked ? "text-foreground" : "text-muted opacity-60"
                  }`}
                >
                  <span>{tier.days}+ days → +{tier.boost}%</span>
                  <span>{unlocked ? "✓" : "🔒"}</span>
                </div>
              );
            })}
          </div>
          <div className="border-border border-t mt-1.5 pt-1.5">
            <p className="text-muted text-[9px]">Miss a day → drop one tier</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Component ─── */

export function StreakCard({ streak, address }: { streak: StreakData; address: string }) {
  const { isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const handleCheckIn = async () => {
    if (!isConnected || !address) return;
    setError("");
    setChecking(true);

    try {
      const message = `${address}\n\nStreak check-in\nTimestamp: ${new Date().toISOString()}`;
      const signature = await signMessageAsync({ message });

      const res = await fetch("/api/airdrop/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Check-in failed");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["airdrop-points", address] });
    } catch {
      setError("Signature rejected or failed");
    } finally {
      setChecking(false);
    }
  };

  const weekDays = useMemo(
    () => getWeekDays(streak.currentStreak, streak.checkedInToday, streak.lastCheckin),
    [streak.currentStreak, streak.checkedInToday, streak.lastCheckin],
  );

  return (
    <div className="bg-surface border-border rounded-[var(--card-radius)] border px-3 py-2.5 space-y-2.5">
      {/* Compact header: streak + boost + check-in button */}
      <div className="flex items-center justify-between">
        <div className="text-foreground text-sm font-bold">
          &#x26A1; {streak.currentStreak} Day{streak.currentStreak !== 1 ? "s" : ""}
          {streak.boostPercent > 0 && (
            <span className="text-accent font-medium"> · +{streak.boostPercent}%</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCheckIn}
          disabled={streak.checkedInToday || checking}
          className="bg-accent text-bg rounded-[var(--card-radius)] px-3 py-1 text-xs font-medium disabled:opacity-50 cursor-pointer"
        >
          {streak.checkedInToday
            ? "✓ Done"
            : checking
              ? "..."
              : "Check In"}
        </button>
      </div>

      {/* Weekly calendar */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAY_LABELS.map((label) => (
          <div key={label} className="text-muted text-[8px] uppercase tracking-wider">
            {label}
          </div>
        ))}
        {weekDays.map((status, i) => (
          <div key={i} className="flex justify-center">
            <DayDot status={status} />
          </div>
        ))}
      </div>

      {/* Next tier + tiers tooltip */}
      <div className="flex items-center justify-between">
        {streak.nextTier ? (
          <div className="text-muted text-[10px]">
            Next: {streak.nextTier.days} days → +{streak.nextTier.boost * 100}%
          </div>
        ) : (
          <div className="text-accent text-[10px] font-medium">Max boost reached!</div>
        )}
        <TiersTooltip currentStreak={streak.currentStreak} />
      </div>

      {error && <div className="text-error text-xs text-center">{error}</div>}
    </div>
  );
}

/* ─── Day dot sub-component ─── */

function DayDot({ status }: { status: DayStatus }) {
  const base = "w-6 h-6 rounded-full flex items-center justify-center text-[10px]";

  switch (status) {
    case "checked":
      return (
        <div className={`${base} bg-accent text-bg font-bold`}>
          &#x2713;
        </div>
      );
    case "today-checked":
      return (
        <div className={`${base} bg-accent text-bg`}>
          &#x1F525;
        </div>
      );
    case "today-pending":
      return (
        <div className={`${base} border-2 border-accent animate-pulse`} />
      );
    case "missed":
      return (
        <div className={`${base} bg-surface border border-border opacity-40`} />
      );
    case "future":
      return (
        <div className={`${base} border border-border`} />
      );
  }
}
