"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StreakCard } from "./StreakCard";
import { useConnectedIdentity } from "../../hooks/useConnectedIdentity";
import { formatUsdValue } from "../../../lib/usd-price";
import { REFERRAL_STORAGE_KEY } from "../../hooks/useReferralCapture";

interface PointsData {
  address: string;
  totalPoints: number;
  sharePercent: number;
  breakdown: { buy: number; referral: number; write: number; rate: number };
  streak: {
    currentStreak: number;
    boostPercent: number;
    nextTier: { days: number; boost: number } | null;
    checkedInToday: boolean;
  };
  referral: {
    code: string | null;
    isFarcasterUsername: boolean;
    referredBy: string | null;
    referredUsersCount: number;
  };
  estimatedAirdrop: { bronze: number; silver: number; gold: number };
}

interface StatusData {
  latestPriceUsd: number | null;
}

const ACTIONS: { key: keyof PointsData["breakdown"]; label: string }[] = [
  { key: "buy", label: "Buying" },
  { key: "referral", label: "Referrals" },
  { key: "write", label: "Writing" },
  { key: "rate", label: "Rating" },
];

function useAirdropPoints(address: string | undefined) {
  return useQuery<PointsData>({
    queryKey: ["airdrop-points", address],
    queryFn: async () => {
      const res = await fetch(`/api/airdrop/points?address=${address!.toLowerCase()}`);
      if (!res.ok) throw new Error("Failed to fetch points");
      return res.json();
    },
    enabled: !!address,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function UserPoints() {
  const { address, isConnected } = useAccount();

  if (!isConnected || !address) {
    return (
      <div className="border-border rounded border p-4 text-center">
        <p className="text-muted text-sm">Connect your wallet to view your points.</p>
      </div>
    );
  }

  return <UserPointsInner address={address} />;
}

function UserPointsInner({ address }: { address: string }) {
  const { data, isLoading } = useAirdropPoints(address);
  const { profile: farcasterProfile } = useConnectedIdentity();

  // Fetch latest price for USD estimates
  const { data: statusData } = useQuery<StatusData>({
    queryKey: ["airdrop-status"],
    queryFn: async () => {
      const res = await fetch("/api/airdrop/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="border-border rounded border p-4">
        <div className="text-muted text-sm">Loading your points...</div>
      </div>
    );
  }

  const price = statusData?.latestPriceUsd ?? null;

  return (
    <div className="space-y-3">
      {/* Points summary */}
      <div className="border-border rounded border p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-muted text-xs">Your PL Points</span>
            <div className="text-foreground text-xl font-bold">{data.totalPoints.toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="text-muted text-[10px]">Your share</div>
            <div className="text-foreground text-sm font-medium">{data.sharePercent.toFixed(2)}%</div>
          </div>
        </div>

        {/* Estimated airdrop */}
        <div className="text-muted text-[10px] mt-2 space-y-0.5">
          {(["bronze", "silver", "gold"] as const).map((tier) => {
            const amount = data.estimatedAirdrop[tier];
            const usdVal = price && amount > 0 ? formatUsdValue(amount * price) : null;
            return (
              <div key={tier}>
                Est. if {tier.charAt(0).toUpperCase() + tier.slice(1)}:{" "}
                <span className="text-foreground font-medium">
                  {amount.toLocaleString()} PLOT
                </span>
                {usdVal && <span className="text-muted"> ({usdVal})</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Streak card */}
      <StreakCard streak={data.streak} address={address} />

      {/* Point breakdown */}
      <div className="border-border rounded border px-3 py-3">
        <div className="text-muted text-xs mb-2">Breakdown</div>
        <div className="space-y-1">
          {ACTIONS.map(({ key, label }) => {
            const pts = data.breakdown[key];
            const pct = data.totalPoints > 0 ? Math.round((pts / data.totalPoints) * 100) : 0;
            return (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-foreground">{label}</span>
                <span className="text-foreground font-medium">
                  {pts.toLocaleString()} PL
                  <span className="text-muted ml-1">({pct}%)</span>
                  {data.streak.boostPercent > 0 && pts > 0 && (
                    <span className="text-accent ml-1">+{data.streak.boostPercent}%</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Referral section */}
      <ReferralSection referral={data.referral} address={address} hasFarcaster={!!farcasterProfile} />
    </div>
  );
}

function ReferralSection({
  referral,
  address,
  hasFarcaster,
}: {
  referral: PointsData["referral"];
  address: string;
  hasFarcaster: boolean;
}) {
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();
  const [referrerCode, setReferrerCode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(REFERRAL_STORAGE_KEY) ?? "";
    }
    return "";
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const referralLink = referral.code ? `${origin}/airdrop?ref=${referral.code}` : null;

  const handleCopy = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (!referralLink) return;
    const text = `Earn PL points in the PLOT 10x Airdrop! ${referralLink}`;
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank",
    );
  };

  const handleSetReferrer = async () => {
    if (!referrerCode.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      const message = `${address}\n\nRegister referral code: ${referrerCode.trim()}\nTimestamp: ${new Date().toISOString()}`;
      const signature = await signMessageAsync({ message });

      const res = await fetch("/api/airdrop/register-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature, referralCode: referrerCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }

      localStorage.removeItem(REFERRAL_STORAGE_KEY);
      queryClient.invalidateQueries({ queryKey: ["airdrop-points", address] });
    } catch {
      setError("Signature rejected or failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Generate referral code via Farcaster username
  const handleUseFarcaster = async () => {
    setError("");
    setSubmitting(true);
    try {
      const message = `${address}\n\nGenerate referral code with Farcaster username\nTimestamp: ${new Date().toISOString()}`;
      const signature = await signMessageAsync({ message });

      const res = await fetch("/api/airdrop/referral-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature, useFarcaster: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to generate code");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["airdrop-points", address] });
    } catch {
      setError("Signature rejected or failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-border rounded border px-3 py-3 space-y-2">
      <div className="text-muted text-xs">Referral</div>

      {/* Referred by */}
      {referral.referredBy ? (
        <div className="text-xs">
          <span className="text-muted">Referred by: </span>
          <span className="text-foreground font-mono">{referral.referredBy}</span>
        </div>
      ) : (
        <div>
          <div className="text-muted text-[10px] mb-1">Who referred you?</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={referrerCode}
              onChange={(e) => setReferrerCode(e.target.value)}
              placeholder="Enter referral code"
              className="bg-surface border-border text-foreground placeholder:text-muted flex-1 rounded border px-2 py-1 text-xs font-mono focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSetReferrer}
              disabled={!referrerCode.trim() || submitting}
              className="bg-accent text-bg rounded px-3 py-1 text-xs font-medium disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "..." : "Set"}
            </button>
          </div>
        </div>
      )}

      {/* Your referral link */}
      {referralLink ? (
        <div>
          <div className="text-muted text-[10px] mb-1">Your referral link</div>
          <div className="bg-surface border-border rounded border px-2 py-1.5 text-xs font-mono text-foreground break-all">
            {referralLink}
          </div>
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="text-accent text-xs hover:underline cursor-pointer"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="text-accent text-xs hover:underline cursor-pointer"
            >
              Share on X
            </button>
          </div>
        </div>
      ) : hasFarcaster ? (
        <div>
          <button
            type="button"
            onClick={handleUseFarcaster}
            disabled={submitting}
            className="text-accent text-xs hover:underline cursor-pointer disabled:opacity-50"
          >
            Use Farcaster username as referral code
          </button>
        </div>
      ) : null}

      {/* Referred users count */}
      <div className="text-xs">
        <span className="text-muted">Referred users: </span>
        <span className="text-foreground font-medium">{referral.referredUsersCount}</span>
      </div>

      {error && <div className="text-error text-xs">{error}</div>}
    </div>
  );
}
