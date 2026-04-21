import type { Metadata } from "next";
import { CampaignHero } from "../../components/airdrop/CampaignHero";
import { MilestoneTrack } from "../../components/airdrop/MilestoneTrack";
import { ReferralInput } from "../../components/ReferralInput";

export const metadata: Metadata = {
  title: "PLOT 10x Airdrop | PlotLink",
  description: "Earn PL points through trading, writing, and referrals.",
};

export default function AirdropPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-8 space-y-6">
      <CampaignHero />
      <MilestoneTrack />

      <section>
        <h2 className="text-foreground text-sm font-bold mb-3">Referral</h2>
        <ReferralInput />
      </section>
    </main>
  );
}
