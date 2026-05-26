"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { CampaignHero } from "../../components/airdrop/CampaignHero";
import { ActivationFlow } from "../../components/airdrop/ActivationFlow";
import { ContributionPanel } from "../../components/airdrop/ContributionPanel";
import { ReferralCTA } from "../../components/airdrop/ReferralCTA";
import { MilestoneClimb } from "../../components/airdrop/MilestoneClimb";
import { ClaimCard } from "../../components/airdrop/ClaimCard";
import { ClaimPanel } from "../../components/airdrop/ClaimPanel";

type AirdropState =
  | "paused"
  | "pre-activation"
  | "mining"
  | "settlement-normal"
  | "settlement-final-burn";

const IS_PAUSED = process.env.NEXT_PUBLIC_AIRDROP_PAUSED === "1";
const MERKLE_CLAIM_ADDRESS = process.env.NEXT_PUBLIC_MERKLE_CLAIM_ADDRESS;
const FINAL_BURN_TX = process.env.NEXT_PUBLIC_AIRDROP_FINAL_BURN_TX;
const FINAL_STATE = process.env.NEXT_PUBLIC_AIRDROP_FINAL_STATE as "sub_bronze" | "zero_recipient" | undefined;

function deriveState(isConnected: boolean, activatedAt: string | null): AirdropState {
  if (IS_PAUSED) return "paused";
  if (MERKLE_CLAIM_ADDRESS) return "settlement-normal";
  if (FINAL_BURN_TX) return "settlement-final-burn";
  if (!isConnected || !activatedAt) return "pre-activation";
  return "mining";
}

const needsFetch = !IS_PAUSED && !MERKLE_CLAIM_ADDRESS && !FINAL_BURN_TX;

function HeroBlock({ isConnected, onActivate }: { isConnected: boolean; onActivate: () => void }) {
  const { openConnectModal } = useConnectModal();

  return (
    <div className="py-10 text-center space-y-5">
      <h1 className="font-[var(--font-display)] text-3xl leading-tight sm:text-4xl">
        The airdrop pool<br />
        <span className="bg-gradient-to-r from-[var(--gold-1)] to-[var(--gold-2)] bg-clip-text text-transparent">grows with us.</span><br />
        <span className="text-[var(--burn)] italic">Or it burns.</span>
      </h1>
      <p className="text-[var(--muted)] text-sm">Buy storyline tokens &middot; Bring friends &middot; Push PLOT together</p>
      {!isConnected ? (
        <button
          onClick={() => openConnectModal?.()}
          className="bg-[var(--accent)] text-[var(--bg)] rounded px-6 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
        >
          Activate to join the Sprint
        </button>
      ) : (
        <button
          onClick={onActivate}
          className="bg-[var(--accent)] text-[var(--bg)] rounded px-6 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
        >
          Activate to join the Sprint
        </button>
      )}
      <p className="text-[var(--muted)] text-xs">One signature + a few clicks. ~2 min.</p>
    </div>
  );
}

export function AirdropStateMachine() {
  const { address, isConnected } = useAccount();
  const [fetchResult, setFetchResult] = useState<{ activatedAt: string | null; done: boolean }>({ activatedAt: null, done: !needsFetch });
  const activationRef = useRef<HTMLDivElement>(null);

  const onActivated = useCallback(() => {
    setFetchResult({ activatedAt: new Date().toISOString(), done: true });
  }, []);

  const scrollToActivation = useCallback(() => {
    activationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    if (!needsFetch || !isConnected || !address) return;

    let cancelled = false;
    fetch(`/api/airdrop/activation-status?address=${address.toLowerCase()}`)
      .then(res => res.json())
      .then(data => { if (!cancelled) setFetchResult({ activatedAt: data.activated_at ?? null, done: true }); })
      .catch(() => { if (!cancelled) setFetchResult({ activatedAt: null, done: true }); });
    return () => { cancelled = true; setFetchResult({ activatedAt: null, done: false }); };
  }, [isConnected, address]);

  const activatedAt = (needsFetch && isConnected) ? fetchResult.activatedAt : null;
  const loading = needsFetch && isConnected && !fetchResult.done;
  const state = deriveState(isConnected, activatedAt);

  if (state === "paused") {
    return (
      <div className="border-[var(--border)] mt-8 rounded border p-8 text-center">
        <h2 className="text-[var(--accent)] mb-2 text-sm font-bold uppercase tracking-wider">Campaign Paused</h2>
        <p className="text-[var(--muted)] text-sm">Campaign temporarily paused. Will resume shortly.</p>
      </div>
    );
  }

  if (state === "settlement-normal") {
    return (
      <>
        <CampaignHero />
        <div className="mt-8"><ClaimPanel /></div>
      </>
    );
  }

  if (state === "settlement-final-burn") {
    return (
      <>
        <CampaignHero />
        <div className="mt-8"><ClaimCard mode="final-burn" finalState={FINAL_STATE ?? null} /></div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <CampaignHero />
        <div className="mt-8 text-center"><p className="text-[var(--muted)] text-sm">Loading...</p></div>
      </>
    );
  }

  if (state === "pre-activation") {
    return (
      <>
        <CampaignHero />
        <HeroBlock isConnected={isConnected} onActivate={scrollToActivation} />
        {isConnected && (
          <div ref={activationRef}>
            <ActivationFlow onActivated={onActivated} />
          </div>
        )}
        <div className="mt-6">
          <MilestoneClimb dimmed />
        </div>
      </>
    );
  }

  // mining
  return (
    <>
      <CampaignHero />
      <div className="mt-8 space-y-4">
        <ContributionPanel />
        <MilestoneClimb />
        <ReferralCTA />
      </div>
    </>
  );
}
