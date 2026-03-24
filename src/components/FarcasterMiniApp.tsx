"use client";

import { useEffect } from "react";
import { usePlatformDetection } from "../hooks/usePlatformDetection";

/**
 * Farcaster Mini App lifecycle — only runs in Farcaster clients.
 *
 * 1. Calls `sdk.actions.ready()` to dismiss the splash screen.
 * 2. If the user hasn't added the app yet, triggers `sdk.actions.addMiniApp()`
 *    which shows the native Farcaster modal for install + notification permission.
 *    The SDK/client handles "already added" state — no re-prompting.
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

      // Dismiss splash screen
      sdk.actions.ready();

      // Check if user has already added the miniapp
      const context = await sdk.context;
      if (cancelled || !context?.client) return;

      if (!context.client.added) {
        // Trigger native add/notification modal — SDK handles dismissal gracefully
        sdk.actions.addMiniApp().catch(() => {
          // User dismissed or SDK error — no action needed
        });
      }
    }).catch(() => {
      // Not in a Farcaster context — silently ignore
    });

    return () => {
      cancelled = true;
    };
  }, [platform, isLoading]);

  return null;
}
