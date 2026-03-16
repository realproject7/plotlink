"use client";

import { useState, useEffect } from "react";

const DEADLINE_HOURS = 168;

export function DeadlineCountdown({ lastPlotTime }: { lastPlotTime: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial sync needed for SSR hydration safety
    setRemaining(calcRemaining(lastPlotTime));
    const interval = setInterval(() => {
      setRemaining(calcRemaining(lastPlotTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastPlotTime]);

  if (remaining === null) {
    return (
      <div className="border-border bg-surface mt-4 rounded border px-3 py-2 text-xs">
        <span className="text-muted">Next plot due in </span>
        <span className="text-accent font-medium">--:--:--</span>
      </div>
    );
  }

  if (remaining <= 0) {
    return (
      <div className="border-error/30 bg-error/5 mt-4 rounded border px-3 py-2 text-xs">
        <span className="text-error">Deadline expired</span>
      </div>
    );
  }

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  return (
    <div className="border-border bg-surface mt-4 rounded border px-3 py-2 text-xs">
      <span className="text-muted">Next plot due in </span>
      <span className="text-accent font-medium">
        {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
        {String(seconds).padStart(2, "0")}
      </span>
    </div>
  );
}

function calcRemaining(lastPlotTime: string): number {
  const deadline =
    new Date(lastPlotTime).getTime() + DEADLINE_HOURS * 60 * 60 * 1000;
  return Math.max(0, Math.floor((deadline - Date.now()) / 1000));
}
