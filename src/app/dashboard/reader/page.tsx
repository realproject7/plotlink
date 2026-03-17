"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { supabase, type Donation } from "../../../../lib/supabase";
import { ReaderPortfolio } from "../../../components/ReaderPortfolio";
import { WriterIdentityClient } from "../../../components/WriterIdentityClient";
import { formatUnits } from "viem";
import { ConnectWallet } from "../../../components/ConnectWallet";
import { RESERVE_LABEL, PLOT_TOKEN, STORY_FACTORY } from "../../../../lib/contracts/constants";
import { publicClient } from "../../../../lib/rpc";
import { type Address } from "viem";

/** Truncate formatUnits output to at most `digits` decimal places */
function formatTruncated(value: bigint, decimals: number, digits = 6): string {
  const raw = formatUnits(value, decimals);
  const dot = raw.indexOf(".");
  if (dot === -1 || raw.length - dot - 1 <= digits) return raw;
  return raw.slice(0, dot + 1 + digits).replace(/0+$/, "").replace(/\.$/, "");
}

const PAGE_SIZE = 50;

interface DonationPage {
  rows: Donation[];
  totalCount: number;
}

async function fetchDonationPage(
  address: string,
  page: number,
): Promise<DonationPage> {
  if (!supabase) return { rows: [], totalCount: 0 };
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, count, error } = await supabase
    .from("donations")
    .select("*", { count: "exact" })
    .eq("donor_address", address.toLowerCase())
    .eq("contract_address", STORY_FACTORY.toLowerCase())
    .order("block_timestamp", { ascending: false })
    .range(from, to)
    .returns<Donation[]>();
  if (error) throw error;
  return { rows: data ?? [], totalCount: count ?? 0 };
}

export default function ReaderDashboard() {
  const { address, isConnected } = useAccount();
  const [page, setPage] = useState(0);

  // Reset to first page when wallet address changes
  useEffect(() => {
    setPage(0);
  }, [address]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["reader-donations", address, page],
    queryFn: () => fetchDonationPage(address!, page),
    enabled: isConnected && !!address,
  });

  // Fetch reserve token decimals dynamically
  const { data: reserveDecimals = 18 } = useQuery({
    queryKey: ["reserve-decimals"],
    queryFn: async () => {
      return publicClient.readContract({
        address: PLOT_TOKEN as Address,
        abi: [{ type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] }] as const,
        functionName: "decimals",
      });
    },
  });

  const donations = data?.rows ?? [];
  const totalCount = data?.totalCount ?? 0;

  if (!isConnected) {
    return (
      <div className="flex min-h-[calc(100vh-2.75rem)] flex-col items-center justify-center gap-4 px-6">
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

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasMore = page + 1 < totalPages;
  const hasPrev = page > 0;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-accent text-2xl font-bold tracking-tight">
        Reader Dashboard
      </h1>
      <p className="text-muted mt-2 text-sm">
        <WriterIdentityClient address={address!} />
      </p>

      <ReaderPortfolio />

      {/* --- Donation History --- */}
      <section className="mt-8">
        <h2 className="text-foreground text-sm font-medium">
          Donation History
        </h2>
        <p className="text-muted mt-1 text-xs">
          {totalCount} {totalCount === 1 ? "donation" : "donations"}
          {donations.length > 0 && (
            <span>
              {" "}
              &middot; {formatTruncated(totalDonated, reserveDecimals)} {RESERVE_LABEL} on this page
            </span>
          )}
        </p>

        {isLoading && <p className="text-muted mt-4 text-sm">Loading...</p>}

        {error && (
          <p className="mt-4 text-sm text-red-400">
            Failed to load donations. Please try again.
          </p>
        )}

        <div className="mt-4 space-y-2">
          {donations.map((d) => (
            <DonationRow key={d.id} donation={d} decimals={reserveDecimals} />
          ))}
          {!isLoading && !error && donations.length === 0 && (
            <p className="text-muted py-6 text-center text-sm">
              No donations yet.
            </p>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!hasPrev}
              className="text-accent disabled:text-muted disabled:cursor-not-allowed"
            >
              &larr; Prev
            </button>
            <span className="text-muted">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="text-accent disabled:text-muted disabled:cursor-not-allowed"
            >
              Next &rarr;
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function DonationRow({ donation, decimals }: { donation: Donation; decimals: number }) {
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
        {formatTruncated(BigInt(donation.amount), decimals)} {RESERVE_LABEL}
      </span>
    </div>
  );
}
