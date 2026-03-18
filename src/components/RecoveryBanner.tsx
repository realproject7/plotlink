"use client";

import { useState } from "react";
import { EXPLORER_URL } from "../../lib/contracts/constants";
import type { PublishIntentData } from "../hooks/usePublishIntent";
import { MAX_RETRY_ATTEMPTS } from "../hooks/usePublishIntent";

interface RecoveryBannerProps {
  intent: PublishIntentData;
  onRetry: () => Promise<{ success: boolean; error?: string }>;
  onDismiss: () => void;
}

export function RecoveryBanner({
  intent,
  onRetry,
  onDismiss,
}: RecoveryBannerProps) {
  const [retrying, setRetrying] = useState(false);
  const exhausted = intent.retryCount >= MAX_RETRY_ATTEMPTS;

  async function handleRetry() {
    setRetrying(true);
    await onRetry();
    setRetrying(false);
  }

  return (
    <div className="border-accent/40 bg-surface mb-6 rounded border p-4">
      <p className="text-foreground text-sm font-medium">
        Your previous story was published on-chain but indexing failed.
      </p>

      {intent.txHash && (
        <p className="text-muted mt-1 text-xs">
          Tx:{" "}
          <a
            href={`${EXPLORER_URL}/tx/${intent.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            {intent.txHash.slice(0, 10)}...{intent.txHash.slice(-8)}
          </a>
        </p>
      )}

      {intent.lastError && (
        <p className="text-error mt-1 text-xs">
          Last error: {intent.lastError}
        </p>
      )}

      {exhausted && (
        <p className="text-muted mt-2 text-xs">
          Max retries reached. You can dismiss — the backfill cron will index
          this automatically, but client-side metadata (genre, language) may be
          lost.
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleRetry}
          disabled={retrying || exhausted}
          className="border-accent text-accent hover:bg-accent hover:text-background rounded border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {retrying ? "Retrying..." : "Retry Indexing"}
        </button>
        <button
          onClick={onDismiss}
          disabled={retrying}
          className="border-border text-muted hover:text-foreground rounded border px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
