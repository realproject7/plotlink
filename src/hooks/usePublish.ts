"use client";

import { useState, useCallback, useRef } from "react";
import { useWriteContract } from "wagmi";
import { hashContent } from "../../lib/content";
import { publicClient } from "../../lib/rpc";
import type { Hex, Abi, TransactionReceipt } from "viem";
import { usePublishIntent } from "./usePublishIntent";

export type PublishState =
  | "idle"
  | "uploading"
  | "confirming"
  | "pending"
  | "indexing"
  | "published"
  | "error";

interface WriteCall {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  gas?: bigint;
}

interface PublishOptions {
  content: string;
  uploadKeyPrefix: string;
  indexerRoute: string;
  buildWriteCall: (cid: string, contentHash: Hex) => WriteCall;
  metadata?: Record<string, string>;
}

/**
 * Shared publishing state machine for StoryFactory write flows.
 *
 * Manages the 5-state flow: uploading -> confirming -> pending -> indexing -> published.
 * Caches CID keyed by content hash for retry (skips re-upload if content unchanged).
 * Integrates with usePublishIntent for crash-safe recovery.
 */
export function usePublish() {
  const [state, setState] = useState<PublishState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);
  const [receipt, setReceipt] = useState<TransactionReceipt | undefined>(
    undefined,
  );
  const cachedCid = useRef<{ cid: string; contentHash: string } | null>(null);

  const { writeContractAsync } = useWriteContract();
  const { saveIntent, persistTxHash, clearIntent } = usePublishIntent();

  const execute = useCallback(
    async (opts: PublishOptions) => {
      try {
        setError(null);
        const contentHash = hashContent(opts.content);

        // 1. Upload to IPFS (reuse cached CID only if content unchanged)
        let cid: string;
        if (
          cachedCid.current &&
          cachedCid.current.contentHash === contentHash
        ) {
          cid = cachedCid.current.cid;
        } else {
          setState("uploading");
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: opts.content,
              key: `${opts.uploadKeyPrefix}/${Date.now()}.txt`,
            }),
          });
          if (!res.ok) throw new Error("IPFS upload failed");
          const data = await res.json();
          cid = data.cid as string;
          cachedCid.current = { cid, contentHash };
        }

        // Save intent before wallet confirmation
        saveIntent({
          content: opts.content,
          metadata: opts.metadata ?? {},
          indexerRoute: opts.indexerRoute,
          uploadKeyPrefix: opts.uploadKeyPrefix,
        });

        // 2. Submit tx to wallet
        setState("confirming");
        const writeCall = opts.buildWriteCall(cid, contentHash);

        let hash: Hex;
        try {
          hash = await writeContractAsync(writeCall);
        } catch (err) {
          // User rejected tx — clear intent, no recovery needed
          clearIntent();
          throw err;
        }
        setTxHash(hash);

        // Persist tx hash after wallet confirms
        persistTxHash(hash);

        // 3. Wait for tx confirmation
        setState("pending");
        const txReceipt = await publicClient.waitForTransactionReceipt({
          hash,
        });

        setReceipt(txReceipt);

        // 4. Trigger indexer
        setState("indexing");
        await new Promise((r) => setTimeout(r, 5000));
        const indexRes = await fetch(opts.indexerRoute, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txHash: hash,
            content: opts.content,
            ...opts.metadata,
          }),
        });

        // 409 = already indexed, treat as success
        if (!indexRes.ok && indexRes.status !== 409) {
          throw new Error(`Indexing failed (${indexRes.status})`);
        }

        // Clear intent on success
        clearIntent();

        // 5. Done
        setState("published");
        cachedCid.current = null;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setState("error");
      }
    },
    [writeContractAsync, saveIntent, persistTxHash, clearIntent],
  );

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    setTxHash(undefined);
    setReceipt(undefined);
    cachedCid.current = null;
  }, []);

  return { state, error, txHash, receipt, execute, reset };
}
