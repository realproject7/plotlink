"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { getFarcasterProfile } from "../../lib/actions";
import type { FarcasterProfile } from "../../lib/farcaster";

/**
 * Resolves the connected wallet's Farcaster identity.
 * Caches result for the session (re-fetches only on address change).
 * Also triggers register-by-wallet to upsert user data in DB.
 */
export function useConnectedIdentity() {
  const { address } = useAccount();
  const [result, setResult] = useState<{
    profile: FarcasterProfile | null;
    resolvedFor: string | undefined;
  }>({ profile: null, resolvedFor: undefined });
  const fetchingRef = useRef(false);
  const registeredRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!address) return;

    let cancelled = false;
    fetchingRef.current = true;

    // Register user in DB (fire-and-forget)
    if (registeredRef.current !== address) {
      registeredRef.current = address;
      fetch("/api/user/register-by-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      }).catch(() => {
        // Non-fatal — profile will still work from live API
      });
    }

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
