"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";

interface StreakData {
  currentStreak: number;
  boostPercent: number;
  nextTier: { days: number; boost: number } | null;
  checkedInToday: boolean;
}

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

  const progressToNext = streak.nextTier
    ? Math.min(100, (streak.currentStreak / streak.nextTier.days) * 100)
    : 100;

  return (
    <div className="border-border rounded border px-3 py-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-foreground text-sm font-bold">
            Streak: {streak.currentStreak} days
          </span>
          {streak.boostPercent > 0 && (
            <span className="text-accent text-xs ml-2">+{streak.boostPercent}% boost</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCheckIn}
          disabled={streak.checkedInToday || checking}
          className="bg-accent text-bg rounded px-3 py-1 text-xs font-medium disabled:opacity-50 cursor-pointer"
        >
          {streak.checkedInToday ? "Checked in today" : checking ? "..." : "Check In"}
        </button>
      </div>

      {streak.nextTier && (
        <>
          <div className="bg-surface border-border h-1.5 rounded-full border overflow-hidden">
            <div
              className="bg-accent h-full rounded-full transition-all"
              style={{ width: `${progressToNext}%` }}
            />
          </div>
          <div className="text-muted text-[9px] mt-0.5">
            Next tier: {streak.nextTier.days} days (+{streak.nextTier.boost * 100}%)
            &middot; {streak.currentStreak}/{streak.nextTier.days}
          </div>
        </>
      )}
      {!streak.nextTier && (
        <div className="text-accent text-[9px]">Max streak tier reached</div>
      )}

      {error && <div className="text-error text-xs mt-1">{error}</div>}
    </div>
  );
}
