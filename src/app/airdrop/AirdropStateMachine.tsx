"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { CampaignHero } from "../../components/airdrop/CampaignHero";
import { ActivationFlow } from "../../components/airdrop/ActivationFlow";
import { ContributionPanel } from "../../components/airdrop/ContributionPanel";
import { ReferralCTA } from "../../components/airdrop/ReferralCTA";
import { MilestoneClimb } from "../../components/airdrop/MilestoneClimb";
import { ClaimCard } from "../../components/airdrop/ClaimCard";

type AirdropState =
  | "paused"
  | "pre-activation"
  | "mining"
  | "settlement-normal"
  | "settlement-final-burn";

function deriveState(
  isConnected: boolean,
  activatedAt: string | null,
): AirdropState {
  if (process.env.NEXT_PUBLIC_AIRDROP_PAUSED === "1") {
    return "paused";
  }

  if (process.env.NEXT_PUBLIC_MERKLE_CLAIM_ADDRESS) {
    return "settlement-normal";
  }

  if (process.env.NEXT_PUBLIC_AIRDROP_FINAL_BURN_TX) {
    return "settlement-final-burn";
  }

  if (!isConnected || !activatedAt) {
    return "pre-activation";
  }

  return "mining";
}

export function AirdropStateMachine() {
  const { address, isConnected } = useAccount();
  const [activatedAt, setActivatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConnected || !address) {
      setActivatedAt(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/airdrop/activation-status?address=${address.toLowerCase()}`)
      .then(res => res.json())
      .then(data => setActivatedAt(data.activated_at ?? null))
      .catch(() => setActivatedAt(null))
      .finally(() => setLoading(false));
  }, [isConnected, address]);

  const state = deriveState(isConnected, activatedAt);

  if (state === "paused") {
    return (
      <>
        <CampaignHero />
        <div className="border-border mt-8 rounded border p-8 text-center">
          <p className="text-muted text-sm">Campaign temporarily paused. Will resume shortly.</p>
        </div>
      </>
    );
  }

  if (state === "settlement-normal") {
    return (
      <>
        <CampaignHero />
        <div className="mt-8">
          <ClaimCard mode="normal" />
        </div>
      </>
    );
  }

  if (state === "settlement-final-burn") {
    const finalState = (process.env.NEXT_PUBLIC_AIRDROP_FINAL_STATE as "sub_bronze" | "zero_recipient" | undefined) ?? null;
    return (
      <>
        <CampaignHero />
        <div className="mt-8">
          <ClaimCard mode="final-burn" finalState={finalState} />
        </div>
      </>
    );
  }

  if (state === "pre-activation") {
    return (
      <>
        <CampaignHero />
        <div className="mt-8">
          {!isConnected ? (
            <div className="border-border rounded border p-8 text-center">
              <p className="text-muted text-sm">Connect your wallet to get started.</p>
            </div>
          ) : (
            <ActivationFlow />
          )}
        </div>
      </>
    );
  }

  // mining state
  if (loading) {
    return (
      <>
        <CampaignHero />
        <div className="mt-8 text-center">
          <p className="text-muted text-sm">Loading...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <CampaignHero />
      <div className="mt-8 space-y-4">
        <ContributionPanel />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ReferralCTA />
          <MilestoneClimb />
        </div>
      </div>
    </>
  );
}
