"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useConnect } from "wagmi";
import type { Platform } from "../hooks/usePlatformDetection";

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

interface FrameProviderProps {
  children: React.ReactNode;
}

export function FrameProvider({ children }: FrameProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [platform, setPlatform] = useState<Platform>("web");
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();
  const connectAttempted = useRef(false);

  useEffect(() => {
    const isClearlyDesktop =
      typeof window !== "undefined" && !window.ethereum && window.self === window.top;

    if (isClearlyDesktop) {
      Promise.resolve().then(() => setIsReady(true));
      return;
    }

    import("@farcaster/miniapp-sdk").then(async ({ sdk }) => {
      try { await sdk.actions.ready(); } catch {}

      const ctx = await withTimeout(sdk.context, 3000, null);

      if (!ctx?.client) {
        if (typeof window !== "undefined" && window.ethereum && /mobile|android/i.test(navigator.userAgent)) {
          setPlatform("base");
        }
        setIsReady(true);
        return;
      }

      if (ctx.client.clientFid === 309857) {
        setPlatform("base");
        setIsReady(true);
        return;
      }

      setPlatform("farcaster");
      setIsReady(true);

      if (!ctx.client.added) {
        try {
          const result = await sdk.actions.addMiniApp();
          if (result?.notificationDetails && ctx.user?.fid) {
            saveTokenClientSide(ctx.user.fid, result.notificationDetails);
          }
        } catch {}
      } else if (ctx.client.notificationDetails && ctx.user?.fid) {
        saveTokenClientSide(ctx.user.fid, ctx.client.notificationDetails);
      }
    }).catch(() => {
      if (typeof window !== "undefined" && window.ethereum && /mobile|android/i.test(navigator.userAgent)) {
        setPlatform("base");
      }
      setIsReady(true);
    });
  }, []);

  useEffect(() => {
    if (!isReady || platform === "web" || isConnected || connectAttempted.current) return;
    connectAttempted.current = true;

    if (platform === "base") {
      const injectedConnector = connectors.find((c) => c.type === "injected");
      if (injectedConnector) {
        connect({ connector: injectedConnector });
      }
      return;
    }

    if (platform === "farcaster") {
      const farcasterConnector = connectors.find((c) => c.type === "farcasterMiniApp");
      if (farcasterConnector) {
        connect({ connector: farcasterConnector });
      }
    }
  }, [isReady, platform, isConnected, connectors, connect]);

  if (!isReady) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf8f5",
          fontFamily: "system-ui, sans-serif",
          color: "#999999",
          fontSize: "14px",
        }}
      >
        Loading PlotLink...
      </div>
    );
  }

  return <>{children}</>;
}

function saveTokenClientSide(
  fid: number,
  details: { token: string; url: string },
) {
  if (!details.token || !details.url) return;
  fetch("/api/notifications/save-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fid, token: details.token, url: details.url }),
  }).catch(() => {});
}
