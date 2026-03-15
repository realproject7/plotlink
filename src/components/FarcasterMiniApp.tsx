"use client";

import { useEffect, useState } from "react";

/**
 * Detects whether the app is running inside a Farcaster client and calls
 * `sdk.actions.ready()` to dismiss the splash screen.
 *
 * Renders nothing — mount once near the root of the component tree.
 */
export function FarcasterMiniApp() {
  const [isMiniApp, setIsMiniApp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const detected =
      url.searchParams.has("fc-miniapp") ||
      url.searchParams.get("miniApp") === "true" ||
      typeof window.parent !== "undefined" &&
        window.parent !== window;

    // Also check for the Farcaster SDK context on the window
    const hasFarcasterContext =
      "farcaster" in window || navigator.userAgent.includes("Farcaster");

    if (detected || hasFarcasterContext) {
      setIsMiniApp(true);
    }
  }, []);

  useEffect(() => {
    if (!isMiniApp) return;

    let cancelled = false;

    import("@farcaster/miniapp-sdk").then(({ sdk }) => {
      if (cancelled) return;
      sdk.actions.ready();
    });

    return () => {
      cancelled = true;
    };
  }, [isMiniApp]);

  return null;
}
