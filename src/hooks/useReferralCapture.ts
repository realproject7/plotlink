"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export const REFERRAL_STORAGE_KEY = "plotlink_ref";

/**
 * Global hook that captures ?ref= query param into localStorage.
 * The actual registration happens via SIWE on the /airdrop page
 * (manual "Who referred you?" flow or pre-filled from stored code).
 */
export function useReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      // Only store if user doesn't already have a referrer stored
      if (!localStorage.getItem(REFERRAL_STORAGE_KEY)) {
        localStorage.setItem(REFERRAL_STORAGE_KEY, ref);
      }
    }
  }, [searchParams]);
}
