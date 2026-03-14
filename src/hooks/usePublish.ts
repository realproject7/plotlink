"use client";

import { useState, useCallback, useRef } from "react";
import { useWriteContract } from "wagmi";
import { storyFactoryAbi } from "../../lib/contracts/abi";
import { STORY_FACTORY } from "../../lib/contracts/constants";
import { hashContent } from "../../lib/content";
import { publicClient } from "../../lib/rpc";
import type { Hex } from "viem";

export type PublishState =
  | "idle"
  | "uploading"
  | "confirming"
  | "pending"
  | "indexing"
  | "published"
  | "error";

interface PublishResult {
  state: PublishState;
  error: string | null;
  txHash: Hex | undefined;
  publish: (
    title: string,
    content: string,
    hasDeadline: boolean,
  ) => Promise<void>;
  reset: () => void;
}

export function usePublishStoryline(): PublishResult {
  const [state, setState] = useState<PublishState>("idle");
  const [error, setError] = useState<string | null>(null);
  const cachedCid = useRef<{ cid: string; contentHash: string } | null>(null);

  const { writeContractAsync, data: txHash } = useWriteContract();

  const publish = useCallback(
    async (title: string, content: string, hasDeadline: boolean) => {
      try {
        setError(null);
        const contentHash = hashContent(content);

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
              content,
              key: `plotlink/genesis/${Date.now()}.txt`,
            }),
          });
          if (!res.ok) throw new Error("IPFS upload failed");
          const data = await res.json();
          cid = data.cid as string;
          cachedCid.current = { cid, contentHash };
        }

        // 2. Submit tx to wallet
        setState("confirming");

        const hash = await writeContractAsync({
          address: STORY_FACTORY,
          abi: storyFactoryAbi,
          functionName: "createStoryline",
          args: [title, cid, contentHash, hasDeadline],
        });

        // 3. Wait for tx confirmation via viem publicClient
        setState("pending");
        await publicClient.waitForTransactionReceipt({ hash });

        // 4. Trigger indexer
        setState("indexing");
        await fetch("/api/index/storyline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash: hash, content }),
        });

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
    [writeContractAsync],
  );

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    cachedCid.current = null;
  }, []);

  return { state, error, txHash, publish, reset };
}
