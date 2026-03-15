"use client";

import { useEffect } from "react";

/**
 * Detects whether the app is running inside a Farcaster client via sdk.context
 * and calls `sdk.actions.ready()` to dismiss the splash screen.
 *
 * Renders nothing — mount once near the root of the component tree.
 */
export function FarcasterMiniApp() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    import("@farcaster/miniapp-sdk").then(async ({ sdk }) => {
      if (cancelled) return;

      // sdk.context is only available when running inside a Farcaster client
      const context = await sdk.context;
      if (!context || cancelled) return;

      sdk.actions.ready();
    }).catch(() => {
      // Not in a Farcaster context — silently ignore
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
