"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { getFarcasterProfile } from "../../lib/actions";
import type { FarcasterProfile } from "../../lib/farcaster";

/**
 * Resolves the connected wallet's Farcaster identity.
 * Caches result for the session (re-fetches only on address change).
 */
export function useConnectedIdentity() {
  const { address } = useAccount();
  const [result, setResult] = useState<{
    profile: FarcasterProfile | null;
    resolvedFor: string | undefined;
  }>({ profile: null, resolvedFor: undefined });
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!address) return;

    let cancelled = false;
    fetchingRef.current = true;
    getFarcasterProfile(address).then((p) => {
      if (!cancelled) {
        setResult({ profile: p, resolvedFor: address });
        fetchingRef.current = false;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!address) return { profile: null, loading: false };

  const loading = result.resolvedFor !== address;
  return { profile: loading ? null : result.profile, loading };
}
