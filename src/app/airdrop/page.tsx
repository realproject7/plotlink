import type { Metadata } from "next";
import { CampaignHero } from "../../components/airdrop/CampaignHero";
import { UserPoints } from "../../components/airdrop/UserPoints";
import { ClaimPanel } from "../../components/airdrop/ClaimPanel";
import { Leaderboard } from "../../components/airdrop/Leaderboard";
import { WeeklySnapshots } from "../../components/airdrop/WeeklySnapshots";
import { MilestoneTrack } from "../../components/airdrop/MilestoneTrack";
import { AIRDROP_CONFIG } from "../../../lib/airdrop/config";

export const metadata: Metadata = {
  title: "PLOT 10x Airdrop | PlotLink",
  description: "Earn PL points through trading, writing, and referrals.",
};

const campaignEnded = new Date() > AIRDROP_CONFIG.CAMPAIGN_END;

export default function AirdropPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-8 space-y-6">
      <CampaignHero />
      {campaignEnded ? <ClaimPanel /> : <UserPoints />}
      <Leaderboard />
      <WeeklySnapshots />
      <MilestoneTrack />
    </main>
  );
}
