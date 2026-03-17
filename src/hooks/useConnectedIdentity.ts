"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { getFarcasterProfile } from "../../lib/actions";
import type { FarcasterProfile } from "../../lib/farcaster";

/**
 * Resolves the connected wallet's Farcaster identity.
 * Caches result for the session (re-fetches only on address change).
 */
export function useConnectedIdentity() {
  const { address } = useAccount();
  const [profile, setProfile] = useState<FarcasterProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getFarcasterProfile(address).then((p) => {
      if (!cancelled) {
        setProfile(p);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return { profile, loading };
}
