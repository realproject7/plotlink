"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFarcasterProfile, getAgentOwnerProfile } from "../../lib/actions";
import { truncateAddress } from "../../lib/utils";
import type { FarcasterProfile } from "../../lib/farcaster";

interface OwnerInfo {
  ownerProfile: FarcasterProfile | null;
  agentName: string;
  agentId: number;
}

/**
 * Client component that resolves a writer identity via server action.
 * For agents with an owner who has a Farcaster profile, shows "{owner}'s AI Writer".
 * Falls back to Farcaster profile or truncated address.
 */
export function WriterIdentityClient({
  address,
  linkProfile = true,
  writerType,
}: {
  address: string;
  linkProfile?: boolean;
  writerType?: number | null;
}) {
  const [profile, setProfile] = useState<FarcasterProfile | null>(null);
  const [ownerInfo, setOwnerInfo] = useState<OwnerInfo | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      // For agents (or unknown), try owner lookup first
      if (writerType === 1 || writerType === undefined || writerType === null) {
        const owner = await getAgentOwnerProfile(address);
        if (!cancelled && owner) {
          setOwnerInfo(owner);
          setLoaded(true);
          return;
        }
      }
      // Fall back to writer's own Farcaster profile
      const p = await getFarcasterProfile(address);
      if (!cancelled) {
        setProfile(p);
        setLoaded(true);
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [address, writerType]);

  if (!loaded) {
    const label = truncateAddress(address);
    if (!linkProfile) return <span>{label}</span>;
    return (
      <Link href={`/profile/${address}`} className="text-foreground hover:text-accent transition-colors">
        {label}
      </Link>
    );
  }

  // Agent with owner Farcaster profile: "{owner}'s AI Writer"
  if (ownerInfo && ownerInfo.ownerProfile) {
    const inner = (
      <span className="inline-flex items-center gap-1">
        {ownerInfo.ownerProfile.pfpUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ownerInfo.ownerProfile.pfpUrl} alt="" width={14} height={14} className="rounded-full" />
        )}
        <span>{ownerInfo.agentName || `${ownerInfo.ownerProfile.displayName || ownerInfo.ownerProfile.username}'s AI Writer`}</span>
      </span>
    );
    if (!linkProfile) return inner;
    return (
      <Link href={`/profile/${address}`} className="text-foreground hover:text-accent transition-colors">
        {inner}
      </Link>
    );
  }

  // Agent without owner FID: plain "AI Writer #{id}"
  if (ownerInfo) {
    const label = `AI Writer #${ownerInfo.agentId}`;
    if (!linkProfile) return <span>{label}</span>;
    return (
      <Link href={`/profile/${address}`} className="text-foreground hover:text-accent transition-colors">
        {label}
      </Link>
    );
  }

  // Regular writer with Farcaster profile
  if (profile) {
    const inner = (
      <span className="inline-flex items-center gap-1">
        {profile.pfpUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.pfpUrl} alt="" width={14} height={14} className="rounded-full" />
        )}
        <span>@{profile.username}</span>
      </span>
    );
    if (!linkProfile) return inner;
    return (
      <Link href={`/profile/${address}`} className="text-foreground hover:text-accent transition-colors">
        {inner}
      </Link>
    );
  }

  // Fallback: truncated address
  const label = truncateAddress(address);
  if (!linkProfile) return <span>{label}</span>;
  return (
    <Link href={`/profile/${address}`} className="text-foreground hover:text-accent transition-colors">
      {label}
    </Link>
  );
}
