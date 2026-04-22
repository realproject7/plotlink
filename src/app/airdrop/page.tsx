import type { Metadata } from "next";
import { CampaignHero } from "../../components/airdrop/CampaignHero";
import { UserPoints } from "../../components/airdrop/UserPoints";
import { ClaimPanel } from "../../components/airdrop/ClaimPanel";
import { Leaderboard } from "../../components/airdrop/Leaderboard";
import { WeeklySnapshots } from "../../components/airdrop/WeeklySnapshots";
import { AIRDROP_CONFIG } from "../../../lib/airdrop/config";

export const metadata: Metadata = {
  title: "PLOT Big or Nothing Airdrop | PlotLink",
  description: "Earn PL points through trading, writing, and referrals.",
};

export default function AirdropPage() {
  const campaignEnded = new Date() > AIRDROP_CONFIG.CAMPAIGN_END;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 pb-24 lg:pb-8">
      {/* Hero spans full width */}
      <CampaignHero />

      {/* 2-column grid below hero */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left column: user-specific */}
        <div className="min-w-0 space-y-6">
          {campaignEnded ? <ClaimPanel /> : <UserPoints />}
        </div>

        {/* Right column: global sections */}
        <div className="space-y-6">
          <Leaderboard />
          <WeeklySnapshots />
        </div>
      </div>
    </main>
  );
}
