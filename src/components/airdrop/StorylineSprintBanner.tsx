"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const DISMISS_KEY = "plotlink_sprint_banner_dismissed";

export function StorylineSprintBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="border-accent/30 bg-accent/5 mt-8 flex items-center gap-3 rounded border px-4 py-3">
      <div className="flex-1 text-xs">
        <span className="text-accent font-bold">Buy-Back Sprint</span>
        <span className="text-muted"> is live. Activate your wallet and earn PLOT.</span>
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
