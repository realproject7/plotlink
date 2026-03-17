"use client";

import { useCallback } from "react";
import { usePublish } from "./usePublish";
import { storyFactoryAbi } from "../../lib/contracts/abi";
import { STORY_FACTORY } from "../../lib/contracts/constants";

/**
 * Chain a plot to an existing storyline (P3-3).
 * Reuses the shared publishing state machine from usePublish.
 */
export function useChainPlot() {
  const { state, error, txHash, execute, reset } = usePublish();

  const chainPlot = useCallback(
    async (storylineId: number, content: string, title = "") => {
      await execute({
        content,
        uploadKeyPrefix: `plotlink/plots/${storylineId}`,
        indexerRoute: "/api/index/plot",
        buildWriteCall: (cid, contentHash) => ({
          address: STORY_FACTORY,
          abi: storyFactoryAbi as unknown as [],
          functionName: "chainPlot",
          args: [BigInt(storylineId), title, cid, contentHash],
          gas: BigInt(500_000),
        }),
      });
    },
    [execute],
  );

  return { state, error, txHash, chainPlot, reset };
}
