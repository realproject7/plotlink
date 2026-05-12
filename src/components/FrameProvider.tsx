"use client";

import { useState, useEffect } from "react";
import { useConnect } from "wagmi";
import { detectPlatform } from "../../lib/farcaster-detect";
import type { Platform } from "../hooks/usePlatformDetection";

interface FrameProviderProps {
  children: React.ReactNode;
}

export function FrameProvider({ children }: FrameProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [platform, setPlatform] = useState<Platform>("web");
  const { connect, connectors } = useConnect();

  useEffect(() => {
    detectPlatform().then((p) => {
      setPlatform(p);
      setIsReady(true);
    });
  }, []);

  useEffect(() => {
    if (!isReady || platform === "web") return;

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
  }, [isReady, platform, connectors, connect]);

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
          color: "#666",
          fontSize: "14px",
        }}
      >
        Loading PlotLink...
      </div>
    );
  }

  return <>{children}</>;
}
