"use client";

import { useState } from "react";
import {
  usePublishIntent,
  MAX_RETRY_COUNT,
} from "../hooks/usePublishIntent";
import { EXPLORER_URL } from "../../lib/contracts/constants";

/**
 * Recovery banner for failed indexing after successful on-chain tx.
 * Mount on any page where publishing can occur (create, chain).
 * Renders nothing if no pending intent exists.
 */
export function PublishRecovery() {
  const { pendingIntent, retryIndexing, clearIntent } = usePublishIntent();
  const [retrying, setRetrying] = useState(false);

  if (!pendingIntent) return null;

  const maxRetriesExceeded = pendingIntent.retryCount >= MAX_RETRY_COUNT;

  const handleRetry = async () => {
    setRetrying(true);
    await retryIndexing();
    setRetrying(false);
  };

  return (
    <div className="mb-6 rounded-lg border border-accent-dim/30 bg-surface px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-accent-dim text-sm">!</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            Previous publish needs indexing
          </p>
          <p className="mt-1 text-xs text-muted">
            Your transaction was confirmed on-chain but indexing failed.
            {maxRetriesExceeded
              ? " Maximum retries reached — the backfill process will handle this automatically."
              : " You can retry indexing or dismiss this notice."}
          </p>

          {/* Tx hash link */}
          {pendingIntent.txHash && (
            <p className="mt-2 text-xs">
              <span className="text-muted">TX: </span>
              <a
                href={`${EXPLORER_URL}/tx/${pendingIntent.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-dim hover:text-accent break-all transition-colors"
              >
                {pendingIntent.txHash.slice(0, 10)}...
                {pendingIntent.txHash.slice(-8)}
              </a>
            </p>
          )}

          {/* Last error */}
          {pendingIntent.lastError && (
            <p className="mt-1 text-xs text-error">
              {pendingIntent.lastError}
              {pendingIntent.retryCount > 0 && (
                <span className="text-muted">
                  {" "}
                  ({pendingIntent.retryCount}/{MAX_RETRY_COUNT} retries)
                </span>
              )}
            </p>
          )}

          {/* Actions */}
          <div className="mt-3 flex gap-2">
            {!maxRetriesExceeded && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                className="rounded border border-accent px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent hover:text-background disabled:opacity-50"
              >
                {retrying ? "Retrying..." : "Retry Indexing"}
              </button>
            )}
            <button
              type="button"
              onClick={clearIntent}
              className="rounded border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
