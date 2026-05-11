"use client";

import { useState, useEffect } from "react";
import { detectPlatform } from "../../lib/farcaster-detect";

export type Platform = "farcaster" | "base" | "web";

export function usePlatformDetection() {
  const [platform, setPlatform] = useState<Platform>("web");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    detectPlatform()
      .then((p) => {
        if (!cancelled) setPlatform(p);
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
