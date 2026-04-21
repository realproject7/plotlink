"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";

const STORAGE_KEY = "plotlink_ref";

/**
 * Global hook that captures ?ref= query param and registers referral on wallet connect.
 * Mount once in root layout or provider.
 */
export function useReferralCapture() {
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();

  // Capture ref param from URL into localStorage
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      localStorage.setItem(STORAGE_KEY, ref);
    }
  }, [searchParams]);

  // On wallet connect, submit stored ref code
  useEffect(() => {
    if (!isConnected || !address) return;

    const ref = localStorage.getItem(STORAGE_KEY);
    if (!ref) return;

    // Register referral (fire-and-forget, non-blocking)
    fetch("/api/airdrop/register-referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: address.toLowerCase(), referralCode: ref }),
    })
      .then((res) => {
        if (res.ok || res.status === 409) {
          // Success or already referred — clear stored code
          localStorage.removeItem(STORAGE_KEY);
        }
      })
      .catch(() => {
        // Silently fail — will retry on next page load
      });
  }, [isConnected, address]);
}
