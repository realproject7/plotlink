"use client";

import { useEffect, useState } from "react";
import { getFarcasterProfile } from "../../lib/actions";
import { truncateAddress } from "../../lib/utils";
import type { FarcasterProfile } from "../../lib/farcaster";

/**
 * Client component that resolves a Farcaster identity via server action.
 * Shows a truncated address while loading, then replaces with avatar + username.
 */
export function WriterIdentityClient({ address }: { address: string }) {
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
    return <span>{truncateAddress(address)}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1">
      {profile.pfpUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.pfpUrl}
          alt=""
          width={14}
          height={14}
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
