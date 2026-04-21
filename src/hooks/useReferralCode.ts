"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

/**
 * Fetches the connected user's referral code (if they have one).
 * Returns null if no code generated yet or wallet not connected.
 */
export function useReferralCode() {
  const { address, isConnected } = useAccount();

  return useQuery({
    queryKey: ["referral-code", address],
    queryFn: async () => {
      const res = await fetch(
        `/api/airdrop/referral-code?address=${address!.toLowerCase()}`,
      );
      if (!res.ok) return null;
      const data = await res.json();
      return (data.code as string) ?? null;
    },
    enabled: isConnected && !!address,
    staleTime: Infinity, // code is immutable
  });
}
