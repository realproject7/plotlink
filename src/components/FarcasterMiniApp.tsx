"use client";

import { useEffect } from "react";
import { usePlatformDetection } from "../hooks/usePlatformDetection";

/**
 * Farcaster Mini App lifecycle — only runs in Farcaster clients.
 *
 * 1. Calls `sdk.actions.ready()` to dismiss the splash screen.
 * 2. If the user hasn't added the app yet, triggers `sdk.actions.addMiniApp()`
 *    which shows the native Farcaster modal for install + notification permission.
 * 3. Saves notification token via webhook (Farcaster sends events server-side).
 *    Also saves client-side from addMiniApp() result as a belt-and-suspenders approach.
 *
 * Renders nothing — mount once near the root of the component tree.
 */
export function FarcasterMiniApp() {
  const { platform, isLoading } = usePlatformDetection();

  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;

    import("@farcaster/miniapp-sdk").then(async ({ sdk }) => {
      if (cancelled) return;

      sdk.actions.ready().catch(() => {});

      if (platform !== "farcaster") return;

      const context = await Promise.race([
        sdk.context,
        new Promise<null>((r) => setTimeout(() => r(null), 3000)),
      ]);
      if (cancelled || !context?.client) return;

      if (context.client.added && context.client.notificationDetails) {
        saveTokenClientSide(
          context.user?.fid,
          context.client.notificationDetails,
        );
      }

      if (!context.client.added) {
        try {
          const result = await sdk.actions.addMiniApp();
          if (result?.notificationDetails) {
            saveTokenClientSide(context.user?.fid, result.notificationDetails);
          }
        } catch {}
      }
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [platform, isLoading]);

  return null;
}

/**
 * Client-side token save — belt-and-suspenders alongside the webhook.
 * Calls a lightweight API endpoint that upserts the token.
 */
function saveTokenClientSide(
  fid: number | undefined,
  details: { token: string; url: string },
) {
  if (!fid || !details.token || !details.url) return;

  fetch("/api/notifications/save-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fid,
      token: details.token,
      url: details.url,
    }),
  }).catch(() => {
    // Non-critical — webhook is the primary path
  });
}
