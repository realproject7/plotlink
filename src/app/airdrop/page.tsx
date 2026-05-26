import type { Metadata } from "next";
import { AirdropStateMachine } from "./AirdropStateMachine";

export const metadata: Metadata = {
  title: "PlotLink Buy-Back Sprint | PlotLink",
  description: "Activate, trade, and earn your share of the PLOT airdrop pool.",
};

export default function AirdropPage() {
  return (
    <main className="mx-auto max-w-[var(--page-max)] px-6 py-8 pb-24 lg:pb-8">
      <AirdropStateMachine />
    </main>
  );
}
