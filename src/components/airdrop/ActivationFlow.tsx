"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { REFERRAL_STORAGE_KEY } from "../../hooks/useReferralCapture";

type StepState = "idle" | "active" | "done";

interface ActivationStatus {
  x_handle_confirmed_at: string | null;
  x_follow_at: string | null;
  fc_verified_at: string | null;
  activated_at: string | null;
}

function StepIndicator({ state, label }: { state: StepState; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {state === "done" && <span className="text-accent">&#x2713;</span>}
      {state === "active" && <span className="text-accent animate-pulse">&#x25CF;</span>}
      {state === "idle" && <span className="text-muted">&#x25CB;</span>}
      <span className={state === "done" ? "text-accent" : state === "active" ? "text-foreground" : "text-muted"}>{label}</span>
    </div>
  );
}

interface ActivationFlowProps {
  onActivated?: () => void;
}

export function ActivationFlow({ onActivated }: ActivationFlowProps) {
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [siweMessage, setSiweMessage] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [xUsername, setXUsername] = useState("");
  const [xPreview, setXPreview] = useState<{ display_name: string; avatar_url: string; follower_count: number } | null>(null);
  const [xConfirmed, setXConfirmed] = useState(false);
  const [xFollowed, setXFollowed] = useState(false);
  const [fcVerified, setFcVerified] = useState(false);
  const [fcUsername, setFcUsername] = useState("");

  useEffect(() => {
    if (!address) return;
    fetch(`/api/airdrop/activation-status?address=${address.toLowerCase()}`)
      .then(r => r.json())
      .then((data: ActivationStatus) => {
        if (data.x_handle_confirmed_at) {
          setXConfirmed(true);
          if (data.x_follow_at) setXFollowed(true);
          if (data.fc_verified_at) setFcVerified(true);
          if (data.activated_at) {
            setStep(3);
            setXFollowed(true);
          } else if (data.x_follow_at) {
            setStep(3);
          } else {
            setStep(3);
          }
        }
      })
      .catch(() => {});
  }, [address]);

  const buildSiweMessage = useCallback(() => {
    if (!address || !chainId) return null;
    const msg = new SiweMessage({
      domain: "plotlink.xyz",
      address,
      statement: "PlotLink Buy-Back Sprint activation",
      uri: "https://plotlink.xyz/airdrop",
      version: "1",
      chainId,
      nonce: Math.random().toString(36).slice(2, 10),
      issuedAt: new Date().toISOString(),
    });
    return msg.prepareMessage();
  }, [address, chainId]);

  const handleSign = async () => {
    setError(null);
    setLoading(true);
    try {
      const msg = buildSiweMessage();
      if (!msg) throw new Error("Wallet not ready");
      const sig = await signMessageAsync({ message: msg });
      setSiweMessage(msg);
      setSignature(sig);

      const refCode = localStorage.getItem(REFERRAL_STORAGE_KEY);
      if (refCode) {
        try {
          const res = await fetch("/api/airdrop/register-referral", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: msg, signature: sig, referralCode: refCode }),
          });
          if (res.ok || res.status === 400 || res.status === 404 || res.status === 409) {
            localStorage.removeItem(REFERRAL_STORAGE_KEY);
          }
        } catch {
          // transient error — keep localStorage for retry
        }
      }

      if (xConfirmed) {
        setStep(3);
      } else {
        setStep(2);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("User rejected")) {
        setError("Signature rejected — please try again.");
      } else {
        setError("Failed to sign. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyX = async () => {
    if (!siweMessage || !signature || !xUsername.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/airdrop/verify-x-handle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: siweMessage, signature, username: xUsername.trim() }),
      });
      if (res.status === 401) {
        setError("Signature expired. Please re-sign.");
        setSiweMessage(null);
        setSignature(null);
        setStep(1);
        return;
      }
      if (res.status === 404) {
        setError("X user not found. Check the handle and try again.");
        return;
      }
      if (!res.ok) {
        setError("Couldn't verify right now. Try again shortly.");
        return;
      }
      const data = await res.json();
      setXPreview(data);
    } catch {
      setError("Couldn't verify right now. Try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmX = async () => {
    if (!siweMessage || !signature || !xUsername.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/airdrop/confirm-x-handle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: siweMessage, signature, username: xUsername.trim() }),
      });
      if (res.status === 401) {
        setError("Signature expired. Please re-sign.");
        setSiweMessage(null);
        setSignature(null);
        setStep(1);
        return;
      }
      if (res.status === 409) {
        setError("This X account is already linked to another wallet.");
        return;
      }
      if (!res.ok) {
        setError("Couldn't confirm right now. Try again shortly.");
        return;
      }
      setXConfirmed(true);
      setXPreview(null);
      setStep(3);
    } catch {
      setError("Couldn't confirm right now. Try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  const handleXFollow = async () => {
    window.open("https://x.com/intent/follow?screen_name=plotlinkxyz", "_blank");
    if (!siweMessage || !signature) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/airdrop/x-follow-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: siweMessage, signature }),
      });
      if (res.status === 401) {
        setError("Signature expired. Please re-sign.");
        setSiweMessage(null);
        setSignature(null);
        setStep(1);
        return;
      }
      if (res.ok) {
        setXFollowed(true);
        const data = await res.json();
        if (data.activated) onActivated?.();
      }
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyFc = async () => {
    if (!siweMessage || !signature || !fcUsername.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/airdrop/verify-fc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: siweMessage, signature, username: fcUsername.trim() }),
      });
      if (res.status === 401) {
        setError("Signature expired. Please re-sign.");
        setSiweMessage(null);
        setSignature(null);
        setStep(1);
        return;
      }
      if (res.status === 404) {
        setError("Couldn't find that FC user.");
        return;
      }
      if (res.status === 422) {
        setError("Looks like you don't follow @plotlink yet — follow and click verify again.");
        return;
      }
      if (res.status === 409) {
        setError("This Farcaster account is already linked.");
        return;
      }
      if (res.status === 502) {
        setError("Farcaster verification unavailable right now. You can skip this step.");
        return;
      }
      if (res.ok) {
        setFcVerified(true);
      }
    } catch {
      setError("Verification failed. You can skip this step.");
    } finally {
      setLoading(false);
    }
  };

  const siweStep: StepState = (siweMessage && signature) ? "done" : step === 1 ? "active" : "idle";
  const xStep: StepState = xConfirmed ? "done" : step === 2 ? "active" : "idle";
  const missionStep: StepState = xFollowed ? "done" : step === 3 ? "active" : "idle";

  return (
    <div className="border-border rounded border p-6 space-y-6">
      <div className="flex gap-4 border-b border-[var(--border)] pb-4">
        <StepIndicator state={siweStep} label="Sign In" />
        <StepIndicator state={xStep} label="Verify X" />
        <StepIndicator state={missionStep} label="Missions" />
      </div>

      {error && (
        <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded p-3 text-xs text-[var(--danger)]">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-muted text-xs">Sign a message to verify wallet ownership.</p>
          <button
            onClick={handleSign}
            disabled={loading}
            className="bg-accent text-background rounded px-4 py-2 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {loading ? "Signing..." : "Sign & Activate"}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-muted text-xs">Enter your X (Twitter) handle to verify your account.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={xUsername}
              onChange={e => { setXUsername(e.target.value); setError(null); }}
              placeholder="@handle"
              className="bg-background border-border text-foreground flex-1 rounded border px-3 py-2 text-xs"
            />
            <button
              onClick={handleVerifyX}
              disabled={loading || !xUsername.trim()}
              className="bg-accent text-background rounded px-4 py-2 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {loading ? "Checking..." : "Verify"}
            </button>
          </div>

          {xPreview && (
            <div className="border-border rounded border p-4 space-y-3">
              <div className="flex items-center gap-3">
                {xPreview.avatar_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={xPreview.avatar_url} alt="" width={40} height={40} className="rounded-full" />
                )}
                <div>
                  <div className="text-foreground text-sm font-medium">{xPreview.display_name}</div>
                  <div className="text-muted text-xs">{xPreview.follower_count.toLocaleString()} followers</div>
                </div>
              </div>
              <button
                onClick={handleConfirmX}
                disabled={loading}
                className="bg-accent text-background w-full rounded px-4 py-2 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {loading ? "Confirming..." : "Yes, that's me"}
              </button>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-foreground text-xs">Follow @plotlinkxyz on X</span>
              {xFollowed ? (
                <span className="text-accent text-xs">&#x2713; Done</span>
              ) : (
                <button
                  onClick={handleXFollow}
                  disabled={loading || !siweMessage}
                  className="bg-accent text-background rounded px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  Follow & Verify
                </button>
              )}
            </div>

            <div className="border-t border-[var(--border)] pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-foreground text-xs">Follow @plotlink on Farcaster <span className="text-muted">(optional)</span></span>
                {fcVerified && <span className="text-accent text-xs">&#x2713; Verified</span>}
              </div>
              {!fcVerified && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={fcUsername}
                    onChange={e => { setFcUsername(e.target.value); setError(null); }}
                    placeholder="FC username"
                    className="bg-background border-border text-foreground flex-1 rounded border px-3 py-1.5 text-xs"
                  />
                  <button
                    onClick={handleVerifyFc}
                    disabled={loading || !fcUsername.trim() || !siweMessage}
                    className="border-accent text-accent rounded border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                  >
                    {loading ? "Verifying..." : "Verify"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {!siweMessage && (
            <div className="border-t border-[var(--border)] pt-3">
              <p className="text-muted mb-2 text-xs">Session expired. Re-sign to continue.</p>
              <button
                onClick={handleSign}
                disabled={loading}
                className="bg-accent text-background rounded px-4 py-2 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {loading ? "Signing..." : "Re-sign"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
