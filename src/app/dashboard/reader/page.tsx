"use client";

import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { supabase, type Donation } from "../../../../lib/supabase";
import { ConnectWallet } from "../../../components/ConnectWallet";
import { formatUnits } from "viem";

async function fetchDonations(address: string): Promise<Donation[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("donations")
    .select("*")
    .eq("donor_address", address.toLowerCase())
    .order("block_timestamp", { ascending: false })
    .returns<Donation[]>();
  return data ?? [];
}

export default function ReaderDashboard() {
  const { address, isConnected } = useAccount();

  const { data: donations = [], isLoading } = useQuery({
    queryKey: ["reader-donations", address],
    queryFn: () => fetchDonations(address!),
    enabled: isConnected && !!address,
  });

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <p className="text-muted text-sm">
          Connect your wallet to view your dashboard.
        </p>
        <ConnectWallet />
      </div>
    );
  }

  const totalDonated = donations.reduce(
    (sum, d) => sum + BigInt(d.amount),
    BigInt(0),
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-accent text-2xl font-bold tracking-tight">
        Reader Dashboard
      </h1>

      {/* --- Portfolio section (Phase 5) --- */}
      <section className="border-border mt-8 rounded border px-4 py-4">
        <h2 className="text-foreground text-sm font-medium">Portfolio</h2>
        <p className="text-muted mt-2 text-xs italic">
          Token holdings and portfolio value available after Phase 5 (P5-7b).
        </p>
      </section>

      {/* --- Donation History --- */}
      <section className="mt-8">
        <h2 className="text-foreground text-sm font-medium">
          Donation History
        </h2>
        <p className="text-muted mt-1 text-xs">
          {donations.length}{" "}
          {donations.length === 1 ? "donation" : "donations"}
          {donations.length > 0 && (
            <span>
              {" "}
              &middot; {formatUnits(totalDonated, 18)} $PLOT total
            </span>
          )}
        </p>

        {isLoading && <p className="text-muted mt-4 text-sm">Loading...</p>}

        <div className="mt-4 space-y-2">
          {donations.map((d) => (
            <DonationRow key={d.id} donation={d} />
          ))}
          {!isLoading && donations.length === 0 && (
            <p className="text-muted py-6 text-center text-sm">
              No donations yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function DonationRow({ donation }: { donation: Donation }) {
  return (
    <div className="border-border flex items-center justify-between rounded border px-3 py-2 text-xs">
      <div className="text-muted flex gap-3">
        <span>
          Story #{donation.storyline_id}
        </span>
        {donation.block_timestamp && (
          <time dateTime={donation.block_timestamp}>
            {new Date(donation.block_timestamp).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </time>
        )}
      </div>
      <span className="text-accent font-medium">
        {formatUnits(BigInt(donation.amount), 18)} $PLOT
      </span>
    </div>
  );
}
