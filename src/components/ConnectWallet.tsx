"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import Link from "next/link";
import { isFarcasterMiniApp } from "../../lib/farcaster-detect";
import { truncateAddress } from "../../lib/utils";
import { useConnectedIdentity } from "../hooks/useConnectedIdentity";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const autoConnectAttempted = useRef(false);
  const [inMiniApp, setInMiniApp] = useState(false);
  const { profile } = useConnectedIdentity();

  // Detect Farcaster mini app context once on mount
  useEffect(() => {
    isFarcasterMiniApp().then(setInMiniApp);
  }, []);

  // Auto-connect with the Farcaster connector when inside a mini app
  useEffect(() => {
    if (!inMiniApp) return;
    if (autoConnectAttempted.current || isConnected) return;
    autoConnectAttempted.current = true;

    const farcasterConnector = connectors.find((c) => c.type === "farcasterMiniApp");
    if (!farcasterConnector) return;

    farcasterConnector.isAuthorized().then((authorized) => {
      if (authorized) {
        connect({ connector: farcasterConnector });
      }
    });
  }, [inMiniApp, connectors, connect, isConnected]);

  if (isConnected && address) {
    return (
      <div className="border-border flex items-center gap-3 rounded border px-3 py-2 text-sm">
        <Link
          href={`/profile/${address}`}
          className="text-accent inline-flex items-center gap-1.5 font-medium hover:opacity-80 transition-opacity"
        >
          {profile?.pfpUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.pfpUrl}
              alt=""
              width={16}
              height={16}
              className="rounded-full"
            />
          )}
          {profile ? `@${profile.username}` : truncateAddress(address)}
        </Link>
        {profile && (
          <span className="text-muted text-[11px] font-mono hidden sm:inline">
            {truncateAddress(address)}
          </span>
        )}
        <button
          onClick={() => disconnect()}
          className="text-muted hover:text-error transition-colors"
        >
          disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        // Use Farcaster connector only when confirmed inside a mini app
        const farcasterConnector = inMiniApp
          ? connectors.find((c) => c.type === "farcasterMiniApp")
          : undefined;
        const fallback = connectors.find((c) => c.type === "injected");
        const connector = farcasterConnector ?? fallback;
        if (connector) connect({ connector });
      }}
      disabled={isPending}
      className="border-accent text-accent hover:bg-accent hover:text-background rounded border px-4 py-2 text-sm transition-colors disabled:opacity-50"
    >
      {isPending ? "connecting..." : "connect wallet"}
    </button>
  );
}
