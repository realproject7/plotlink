"use client";

import { useEffect } from "react";
import { usePlatformDetection } from "../hooks/usePlatformDetection";

/**
 * Calls `sdk.actions.ready()` to dismiss the splash screen — only in Farcaster clients.
 * After Base App migration (April 2026), Base App operates as standard web app.
 *
 * Renders nothing — mount once near the root of the component tree.
 */
export function FarcasterMiniApp() {
  const { platform, isLoading } = usePlatformDetection();

  useEffect(() => {
    if (isLoading || platform !== "farcaster") return;

    let cancelled = false;

    import("@farcaster/miniapp-sdk").then(async ({ sdk }) => {
      if (cancelled) return;
      sdk.actions.ready();
    }).catch(() => {
      // Not in a Farcaster context — silently ignore
    });

    return () => {
      cancelled = true;
    };
  }, [platform, isLoading]);

  return null;
}
