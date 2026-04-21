import type { Metadata } from "next";
import { ReferralInput } from "../../components/ReferralInput";

export const metadata: Metadata = {
  title: "PLOT 10x Airdrop | PlotLink",
  description: "Earn PL points through trading, writing, and referrals.",
};

export default function AirdropPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-foreground text-xl font-bold mb-2">PLOT 10x Airdrop</h1>
      <p className="text-muted text-sm mb-6">
        Earn PL points through trading, writing, rating, and referrals.
        Campaign details coming soon.
      </p>

      <section className="mb-6">
        <h2 className="text-foreground text-sm font-bold mb-3">Referral</h2>
        <ReferralInput />
      </section>
    </main>
  );
}
