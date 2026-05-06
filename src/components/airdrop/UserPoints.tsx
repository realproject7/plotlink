"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
    lastCheckin: string | null;
  };
  referral: {
    code: string | null;
    isFarcasterUsername: boolean;
    referredBy: string | null;
    referredUsersCount: number;
  };
  estimatedAirdrop: { bronze: number; silver: number; gold: number; diamond: number };
}

interface StatusData {
  latestPriceUsd: number | null;
  milestones: {
    bronze: { mcap: number; pct: number; reached: boolean };
    silver: { mcap: number; pct: number; reached: boolean };
    gold: { mcap: number; pct: number; reached: boolean };
    diamond: { mcap: number; pct: number; reached: boolean };
  };
  currentFdv: number;
}

const ACTIONS: { key: keyof PointsData["breakdown"]; label: string }[] = [
  { key: "buy", label: "Buying" },
  { key: "referral", label: "Referrals" },
  { key: "write", label: "Writing" },
  { key: "rate", label: "Rating" },
];

const MAX_SUPPLY = 1_000_000;
const TIER_KEYS = ["bronze", "silver", "gold", "diamond"] as const;

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

function formatCompact(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(0)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

/* ─── Tooltip component ─── */

function InfoTooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-muted hover:text-foreground text-[11px] ml-1 cursor-pointer"
        aria-label="Show details"
      >
        &#9432;
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-10 bg-surface border-border border rounded p-2.5 shadow-sm min-w-[240px] text-xs">
          {children}
        </div>
      )}
    </div>
  );
}

export function UserPoints() {
  const { address, isConnected } = useAccount();

  if (!isConnected || !address) {
    return (
      <div className="bg-surface border-border rounded-[var(--card-radius)] border p-4 text-center">
        <p className="text-muted text-sm">Connect your wallet to view your points.</p>
      </div>
    );
  }

  return <UserPointsInner address={address} />;
}

function UserPointsInner({ address }: { address: string }) {
  const { data, isLoading } = useAirdropPoints(address);
  const { profile: farcasterProfile } = useConnectedIdentity();
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const { data: statusData } = useQuery<StatusData>({
    queryKey: ["airdrop-status"],
    queryFn: async () => {
      const res = await fetch("/api/airdrop/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    staleTime: 60_000,
  });

  const currentEstimate = useMemo(() => {
    if (!data || !statusData) return null;
    const currentFdv = statusData.currentFdv;
    const price = statusData.latestPriceUsd;
    let key: (typeof TIER_KEYS)[number] = "bronze";
    for (let i = TIER_KEYS.length - 1; i >= 0; i--) {
      if (currentFdv >= statusData.milestones[TIER_KEYS[i]].mcap) {
        key = TIER_KEYS[i];
        break;
      }
    }
    const amount = data.estimatedAirdrop[key];
    return { amount, usd: price && amount > 0 ? amount * price : null };
  }, [data, statusData]);

  if (isLoading || !data) {
    return (
      <div className="bg-surface border-border rounded-[var(--card-radius)] border p-4">
        <div className="text-muted text-sm">Loading your points...</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Points summary */}
      <div className="bg-surface border-border rounded-[var(--card-radius)] border p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-muted text-xs">Your PL Points</span>
            <div className="text-foreground text-xl font-bold">{data.totalPoints.toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="text-muted text-[10px]">Share</div>
            <div className="text-foreground text-sm font-medium">{data.sharePercent.toFixed(2)}%</div>
          </div>
        </div>

        {/* Single estimated airdrop line + tooltip */}
        {currentEstimate && (
          <div className="mt-2 text-xs">
            <span className="text-muted">Est. airdrop: </span>
            <span className="text-foreground font-medium">
              {currentEstimate.amount.toLocaleString()} PLOT
            </span>
            {currentEstimate.usd && (
              <span className="text-muted"> (~{formatUsdValue(currentEstimate.usd)})</span>
            )}
            <InfoTooltip>
              <div className="space-y-1">
                {TIER_KEYS.map((key) => {
                  const amount = data.estimatedAirdrop[key];
                  const fdv = statusData?.milestones[key].mcap ?? 0;
                  const scenarioPrice = fdv / MAX_SUPPLY;
                  const scenarioUsd = amount > 0 ? formatUsdValue(amount * scenarioPrice) : null;
                  return (
                    <div key={key} className="text-muted">
                      At {formatCompact(fdv)} MCap →{" "}
                      <span className="text-foreground font-medium">
                        {amount.toLocaleString()} PLOT
                      </span>
                      {scenarioUsd && <span> (~{scenarioUsd})</span>}
                    </div>
                  );
                })}
              </div>
            </InfoTooltip>
            <div className="text-muted text-[10px] mt-0.5">(based on current MCap)</div>
          </div>
        )}
      </div>

      {/* Streak card */}
      <StreakCard streak={data.streak} address={address} />

      {/* Point breakdown — collapsed by default */}
      <div className="bg-surface border-border rounded-[var(--card-radius)] border px-3 py-2.5">
        <button
          type="button"
          onClick={() => setBreakdownOpen(!breakdownOpen)}
          className="w-full flex items-center justify-between text-muted text-xs cursor-pointer"
        >
          <span>Breakdown</span>
          <span className="text-[10px]">{breakdownOpen ? "▾" : "▸"}</span>
        </button>
        {breakdownOpen && (
          <div className="space-y-1 mt-2">
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
        )}
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
    const text = `Earn PL points in the PLOT Big or Nothing Airdrop! ${referralLink}`;
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

  const handleUseFarcaster = async () => {
    setError("");
    setSubmitting(true);
    try {
      const message = `${address}\n\nGenerate referral code with Farcaster username\nTimestamp: ${new Date().toISOString()}`;
      const signature = await signMessageAsync({ message });

      const res = await fetch("/api/airdrop/referral-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature, useFarcasterUsername: true }),
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
    <div className="bg-surface border-border rounded-[var(--card-radius)] border px-3 py-2.5 space-y-2">
      {/* Referral link + actions */}
      {referralLink ? (
        <div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted">&#x1F517;</span>
            <span className="text-foreground font-mono text-[11px] truncate flex-1">
              {referralLink}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="text-accent text-xs hover:underline cursor-pointer shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="text-accent text-xs hover:underline cursor-pointer shrink-0"
            >
              &#x1D54F;
            </button>
          </div>
          <div className="text-[10px] text-muted mt-1">
            {referral.referredUsersCount} referred
            {referral.referredBy && (
              <span>
                {" · "}Referred by: <span className="text-foreground font-mono">{referral.referredBy}</span>
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {hasFarcaster && (
            <button
              type="button"
              onClick={handleUseFarcaster}
              disabled={submitting}
              className="text-accent text-xs hover:underline cursor-pointer disabled:opacity-50"
            >
              Use Farcaster username as referral code
            </button>
          )}
        </div>
      )}

      {/* Referred by input (only if not yet set) */}
      {!referral.referredBy && (
        <div className="flex gap-2">
          <input
            type="text"
            value={referrerCode}
            onChange={(e) => setReferrerCode(e.target.value)}
            placeholder="Who referred you?"
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
      )}

      {error && <div className="text-error text-xs">{error}</div>}
    </div>
  );
}
