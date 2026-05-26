"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
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

function deriveState(
  isConnected: boolean,
  activatedAt: string | null,
): AirdropState {
  if (IS_PAUSED) return "paused";
  if (MERKLE_CLAIM_ADDRESS) return "settlement-normal";
  if (FINAL_BURN_TX) return "settlement-final-burn";
  if (!isConnected || !activatedAt) return "pre-activation";
  return "mining";
}

const needsFetch = !IS_PAUSED && !MERKLE_CLAIM_ADDRESS && !FINAL_BURN_TX;

export function AirdropStateMachine() {
  const { address, isConnected } = useAccount();
  const [activatedAt, setActivatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(needsFetch && isConnected);

  useEffect(() => {
    if (!needsFetch || !isConnected || !address) {
      setActivatedAt(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/airdrop/activation-status?address=${address.toLowerCase()}`)
      .then(res => res.json())
      .then(data => { if (!cancelled) setActivatedAt(data.activated_at ?? null); })
      .catch(() => { if (!cancelled) setActivatedAt(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isConnected, address]);

  const state = deriveState(isConnected, activatedAt);

  if (state === "paused") {
    return (
      <div className="border-border mt-8 rounded border p-8 text-center">
        <h2 className="text-accent mb-2 text-sm font-bold uppercase tracking-wider">Campaign Paused</h2>
        <p className="text-muted text-sm">Campaign temporarily paused. Will resume shortly.</p>
      </div>
    );
  }

  if (state === "settlement-normal") {
    return (
      <>
        <CampaignHero />
        <div className="mt-8">
          <ClaimPanel />
        </div>
      </>
    );
  }

  if (state === "settlement-final-burn") {
    return (
      <>
        <CampaignHero />
        <div className="mt-8">
          <ClaimCard mode="final-burn" finalState={FINAL_STATE ?? null} />
        </div>
      </>
    );
  }

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
