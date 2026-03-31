"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { isFarcasterMiniApp } from "../../lib/farcaster-detect";
import { truncateAddress } from "../../lib/utils";
import { useConnectedIdentity } from "../hooks/useConnectedIdentity";

export function ConnectWallet({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
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

  // Connected state: show Farcaster PFP + username + address + disconnect
  if (isConnected && address) {
    return (
      <div className="border-border flex items-center gap-3 rounded border px-3 py-2 text-sm">
        <Link
          href={`/profile/${address}`}
          onClick={onNavigate}
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
          <span className="text-muted text-[10px] font-mono">
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

  // Disconnected state: RainbowKit modal (outside Farcaster) or auto-connect (inside)
  return (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted }) => {
        const ready = mounted;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none" as const,
                userSelect: "none" as const,
              },
            })}
          >
            <button
              onClick={openConnectModal}
              type="button"
              className="border-accent text-accent hover:bg-accent hover:text-background rounded border px-4 py-2 text-sm transition-colors"
            >
              connect wallet
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
