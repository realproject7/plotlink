"use client";

import { useEffect, useState } from "react";
import { getFarcasterProfile } from "../../lib/actions";
import { truncateAddress } from "../../lib/utils";
import type { FarcasterProfile } from "../../lib/farcaster";

/**
 * Resolves an Ethereum address to a Farcaster identity via server action.
 * Shows avatar + @username with link, or falls back to truncated address.
 */
export function FarcasterAvatar({
  address,
  size = 14,
  className,
}: {
  address: string;
  size?: number;
  className?: string;
}) {
  const [profile, setProfile] = useState<FarcasterProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getFarcasterProfile(address).then((p) => {
      if (!cancelled) {
        setProfile(p);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!loaded || !profile) {
    return <span className={className}>{truncateAddress(address)}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      {profile.pfpUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.pfpUrl}
          alt=""
          width={size}
          height={size}
          className="rounded-full"
        />
      )}
      <a
        href={`https://farcaster.com/${profile.username}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground hover:text-accent transition-colors"
      >
        @{profile.username}
      </a>
    </span>
  );
}
