"use client";

import { useEffect, useRef } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { truncateAddress } from "../../lib/utils";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const autoConnectAttempted = useRef(false);

  // Auto-connect with the Farcaster connector when inside a mini app
  useEffect(() => {
    if (autoConnectAttempted.current || isConnected) return;
    autoConnectAttempted.current = true;

    const farcasterConnector = connectors.find((c) => c.type === "farcaster");
    if (!farcasterConnector) return;

    // Only auto-connect if the Farcaster connector reports it's authorized
    // (i.e. we're inside a Farcaster client with an active wallet)
    farcasterConnector.isAuthorized().then((authorized) => {
      if (authorized) {
        connect({ connector: farcasterConnector });
      }
    });
  }, [connectors, connect, isConnected]);

  if (isConnected && address) {
    return (
      <div className="border-border flex items-center gap-3 rounded border px-3 py-2 text-sm">
        <span className="text-accent font-medium">
          {truncateAddress(address)}
        </span>
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
        // Prefer the Farcaster connector if available, otherwise injected
        const farcasterConnector = connectors.find(
          (c) => c.type === "farcaster",
        );
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
