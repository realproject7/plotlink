"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface PublishIntent {
  txHash: string | null;
  content: string;
  metadata: Record<string, string>;
  indexerRoute: string;
  uploadKeyPrefix: string;
  createdAt: number;
  retryCount: number;
  lastError: string | null;
}

const STORAGE_KEY = "plotlink_publish_intent_v1";
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MAX_RETRY_COUNT = 5;

function readIntent(): PublishIntent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PublishIntent;
  } catch {
    return null;
  }
}

function writeIntent(intent: PublishIntent): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
  } catch {
    // localStorage full or unavailable
  }
}

function removeIntent(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silent
  }
}

/**
 * localStorage-backed publish intent for crash-safe recovery.
 *
 * Stores intent before wallet confirmation. If the browser crashes after
 * on-chain tx but before indexing completes, the intent survives and can
 * be retried on next page load.
 */
export function usePublishIntent() {
  const [pendingIntent, setPendingIntent] = useState<PublishIntent | null>(
    () => {
      if (typeof window === "undefined") return null;
      const intent = readIntent();
      if (!intent) return null;
      // Discard intents without txHash that are older than 24h
      if (
        !intent.txHash &&
        Date.now() - intent.createdAt > STALE_THRESHOLD_MS
      ) {
        removeIntent();
        return null;
      }
      // Only surface intents that have a txHash (tx confirmed) but indexing never succeeded
      return intent.txHash ? intent : null;
    },
  );
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const saveIntent = useCallback(
    (data: Omit<PublishIntent, "txHash" | "createdAt" | "retryCount" | "lastError">) => {
      const intent: PublishIntent = {
        ...data,
        txHash: null,
        createdAt: Date.now(),
        retryCount: 0,
        lastError: null,
      };
      writeIntent(intent);
    },
    [],
  );

  const persistTxHash = useCallback((hash: string) => {
    const intent = readIntent();
    if (!intent) return;
    const updated = { ...intent, txHash: hash };
    writeIntent(updated);
    // Don't setPendingIntent here — avoids recovery UI flash during active session
  }, []);

  const clearIntent = useCallback(() => {
    removeIntent();
    if (mountedRef.current) setPendingIntent(null);
  }, []);

  const retryIndexing = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    const intent = readIntent();
    if (!intent?.txHash) {
      return { success: false, error: "No transaction found" };
    }

    try {
      const response = await fetch(intent.indexerRoute, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: intent.txHash,
          content: intent.content,
          ...intent.metadata,
        }),
      });

      // 409 = already indexed (idempotent success)
      if (response.ok || response.status === 409) {
        removeIntent();
        if (mountedRef.current) setPendingIntent(null);
        return { success: true };
      }

      const errorMessage = `Indexer error (${response.status})`;
      const updated: PublishIntent = {
        ...intent,
        retryCount: intent.retryCount + 1,
        lastError: errorMessage,
      };
      writeIntent(updated);
      if (mountedRef.current) setPendingIntent(updated);
      return { success: false, error: errorMessage };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Network error";
      const updated: PublishIntent = {
        ...intent,
        retryCount: intent.retryCount + 1,
        lastError: errorMessage,
      };
      writeIntent(updated);
      if (mountedRef.current) setPendingIntent(updated);
      return { success: false, error: errorMessage };
    }
  }, []);

  return {
    pendingIntent,
    saveIntent,
    persistTxHash,
    clearIntent,
    retryIndexing,
  };
}
