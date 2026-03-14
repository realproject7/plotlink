"use client";

import { useState, useCallback, useRef } from "react";
import { useWriteContract } from "wagmi";
import { storyFactoryAbi } from "../../lib/contracts/abi";
import { STORY_FACTORY } from "../../lib/contracts/constants";
import { hashContent } from "../../lib/content";
import { publicClient } from "../../lib/rpc";
import type { PublishState } from "./usePublish";
import type { Hex } from "viem";

interface ChainPlotResult {
  state: PublishState;
  error: string | null;
  txHash: Hex | undefined;
  chainPlot: (storylineId: number, content: string) => Promise<void>;
  reset: () => void;
}

export function useChainPlot(): ChainPlotResult {
  const [state, setState] = useState<PublishState>("idle");
  const [error, setError] = useState<string | null>(null);
  const cachedCid = useRef<{ cid: string; contentHash: string } | null>(null);

  const { writeContractAsync, data: txHash } = useWriteContract();

  const chainPlot = useCallback(
    async (storylineId: number, content: string) => {
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
              key: `plotlink/plots/${storylineId}-${Date.now()}.txt`,
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
          functionName: "chainPlot",
          args: [BigInt(storylineId), cid, contentHash],
        });

        // 3. Wait for tx confirmation
        setState("pending");
        await publicClient.waitForTransactionReceipt({ hash });

        // 4. Trigger indexer
        setState("indexing");
        await fetch("/api/index/plot", {
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

  return { state, error, txHash, chainPlot, reset };
}
