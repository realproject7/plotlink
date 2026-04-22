"use client";

import { useState, useMemo } from "react";
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
  // Get Monday of the current week (UTC)
  const todayDow = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = todayDow === 0 ? -6 : 1 - todayDow;
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() + mondayOffset);
  monday.setUTCHours(0, 0, 0, 0);

  const todayStr = now.toISOString().slice(0, 10);
  const lastCheckinStr = lastCheckin ? new Date(lastCheckin).toISOString().slice(0, 10) : null;

  // Build set of checked-in dates this week by walking back from lastCheckin
  const checkedDates = new Set<string>();
  if (lastCheckinStr && currentStreak > 0) {
    const lastDate = new Date(lastCheckinStr + "T00:00:00Z");
    for (let i = 0; i < currentStreak; i++) {
      const d = new Date(lastDate);
      d.setUTCDate(d.getUTCDate() - i);
      const ds = d.toISOString().slice(0, 10);
      // Only include dates in this week
      if (d >= monday) checkedDates.add(ds);
      else break; // no need to go further back
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

  // Current tier index for highlight
  const currentTierIdx = useMemo(() => {
    for (let i = BOOST_TIERS.length - 1; i >= 0; i--) {
      if (streak.currentStreak >= BOOST_TIERS[i].days) return i;
    }
    return -1;
  }, [streak.currentStreak]);

  return (
    <div className="border-border rounded border px-3 py-3 space-y-3">
      {/* Header: streak count + boost */}
      <div className="text-center">
        <div className="text-foreground text-lg font-bold">
          &#x26A1; {streak.currentStreak} Day{streak.currentStreak !== 1 ? "s" : ""} Streak
        </div>
        {streak.boostPercent > 0 && (
          <div className="text-accent text-xs font-medium">
            Current boost: +{streak.boostPercent}%
          </div>
        )}
      </div>

      {/* Weekly calendar */}
      <div className="border-border rounded border px-2 py-2">
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
      </div>

      {/* Check In button */}
      <div className="text-center">
        <button
          type="button"
          onClick={handleCheckIn}
          disabled={streak.checkedInToday || checking}
          className="bg-accent text-bg rounded px-4 py-1.5 text-xs font-medium disabled:opacity-50 cursor-pointer"
        >
          {streak.checkedInToday
            ? "Checked in today \u2713"
            : checking
              ? "Signing..."
              : "Check In"}
        </button>
      </div>

      {error && <div className="text-error text-xs text-center">{error}</div>}

      {/* Boost tiers table */}
      <div>
        <div className="text-muted text-[10px] font-medium uppercase tracking-wider mb-1">
          Boost Tiers
        </div>
        <div className="space-y-0.5">
          {BOOST_TIERS.map((tier, i) => {
            const unlocked = streak.currentStreak >= tier.days;
            const isCurrent = i === currentTierIdx;
            return (
              <div
                key={tier.days}
                className={`flex items-center justify-between text-xs px-2 py-0.5 rounded ${
                  isCurrent ? "bg-accent/10 text-foreground font-medium" : "text-muted"
                }`}
              >
                <span>{tier.days}+ days</span>
                <span>+{tier.boost}%</span>
                <span className="w-16 text-right text-[10px]">
                  {isCurrent ? (
                    <span className="text-accent">&larr; current</span>
                  ) : unlocked ? (
                    <span className="text-foreground">&check; unlocked</span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-muted text-[9px] mt-1.5 leading-relaxed">
          Boost applies to all PL point earnings. Miss a day? Drop one tier (not full reset).
        </p>
      </div>
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
