"use client";

import { useState, useEffect } from "react";

export type Platform = "farcaster" | "base" | "web";

export function usePlatformDetection() {
  const [platform, setPlatform] = useState<Platform>("web");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    import("@farcaster/miniapp-sdk")
      .then(async ({ sdk }) => {
        if (cancelled) return;
        const context = await sdk.context;
        if (!context?.client || cancelled) return;

        if (context.client.clientFid === 309857) {
          setPlatform("base");
        } else {
          setPlatform("farcaster");
        }
      })
      .catch(() => {
        // SDK not available = web browser
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { platform, isLoading, isMiniApp: platform !== "web" };
}
