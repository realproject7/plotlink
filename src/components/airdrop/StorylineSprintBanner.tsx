"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const DISMISS_KEY = "plotlink_sprint_banner_dismissed";

function formatMcap(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export function StorylineSprintBanner() {
  const [state, setState] = useState<{
    dismissed: boolean;
    status: { timeElapsedPercent: number; currentFdv: number } | null;
  }>({ dismissed: true, status: null });

  useEffect(() => {
    const isDismissed = localStorage.getItem(DISMISS_KEY) === "1";
    fetch("/api/airdrop/status")
      .then(r => r.ok ? r.json() : null)
      .then(d => setState({
        dismissed: isDismissed,
        status: d ? { timeElapsedPercent: d.timeElapsedPercent, currentFdv: d.currentFdv } : null,
      }))
      .catch(() => setState(prev => ({ ...prev, dismissed: isDismissed })));
  }, []);

  const { dismissed, status } = state;

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setState(prev => ({ ...prev, dismissed: true }));
  };

  const dayNum = status ? Math.ceil(status.timeElapsedPercent / 100 * 90) || 1 : null;

  return (
    <div className="border-accent/30 bg-accent/5 mt-8 flex items-center gap-3 rounded border px-4 py-3">
      <div className="flex-1 text-xs">
        <span className="text-accent font-bold">Buy-Back Sprint</span>
        {dayNum && status && (
          <span className="text-muted"> · Day {dayNum}/90 · FDV {formatMcap(status.currentFdv)}</span>
        )}
      </div>
      <Link
        href="/airdrop"
        className="bg-accent text-background shrink-0 rounded px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
      >
        Join
      </Link>
      <button
        onClick={handleDismiss}
        className="text-muted hover:text-foreground shrink-0 text-sm transition-colors"
        title="Dismiss"
      >
        &#x2715;
      </button>
    </div>
  );
}
