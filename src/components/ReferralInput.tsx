"use client";

import { useState, useEffect } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { REFERRAL_STORAGE_KEY } from "../hooks/useReferralCapture";

/**
 * "Who referred you?" input — one-time, non-editable once submitted.
 * Only visible when user has no referrer set. Pre-fills from localStorage ref capture.
 */
export function ReferralInput() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Check if user already has a referrer
  const { data: referrerData, isLoading } = useQuery({
    queryKey: ["my-referrer", address],
    queryFn: async () => {
      const res = await fetch(
        `/api/airdrop/register-referral?address=${address!.toLowerCase()}`,
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.referrer) return null;
      return { referrer: data.referrer as string, displayName: data.displayName as string };
    },
    enabled: isConnected && !!address,
    staleTime: Infinity,
  });

  // Pre-fill from localStorage capture
  useEffect(() => {
    const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (stored && !code) {
      setCode(stored);
    }
  }, [code]);

  if (!isConnected || isLoading) return null;

  // Already has a referrer — show read-only
  if (referrerData) {
    return (
      <div className="border-border rounded border px-4 py-3">
        <div className="text-muted text-xs">Referred by</div>
        <div className="text-foreground text-sm font-mono mt-1">
          {referrerData.displayName}
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!code.trim() || !address) return;
    setError("");
    setSubmitting(true);

    try {
      const message = `${address}\n\nRegister referral code: ${code.trim()}\nTimestamp: ${new Date().toISOString()}`;
      const signature = await signMessageAsync({ message });

      const res = await fetch("/api/airdrop/register-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature, referralCode: code.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }

      // Clear localStorage and refresh query
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
      queryClient.invalidateQueries({ queryKey: ["my-referrer", address] });
    } catch {
      setError("Signature rejected or failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-border rounded border px-4 py-3">
      <div className="text-muted text-xs mb-2">Who referred you?</div>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter referral code"
          className="bg-surface border-border text-foreground placeholder:text-muted flex-1 rounded border px-3 py-1.5 text-sm font-mono focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!code.trim() || submitting}
          className="bg-accent text-bg rounded px-4 py-1.5 text-sm font-medium disabled:opacity-50 cursor-pointer"
        >
          {submitting ? "..." : "Submit"}
        </button>
      </div>
      {error && <div className="text-error text-xs mt-1">{error}</div>}
    </div>
  );
}
