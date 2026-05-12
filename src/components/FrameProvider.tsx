"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useConnect } from "wagmi";
import { detectPlatform } from "../../lib/farcaster-detect";
import type { Platform } from "../hooks/usePlatformDetection";

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
    if (typeof window !== "undefined" && !window.ethereum && window.self === window.top) {
      setIsReady(true);
      return;
    }
    detectPlatform().then((p) => {
      setPlatform(p);
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
          background: "#0a0a0a",
          fontFamily: "system-ui, sans-serif",
          color: "#666666",
          fontSize: "14px",
        }}
      >
        Loading PlotLink...
      </div>
    );
  }

  return <>{children}</>;
}
