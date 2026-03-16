"use client";

import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { supabase, type Storyline } from "../../../../lib/supabase";
import { getTokenTVL } from "../../../../lib/price";
import { RESERVE_LABEL } from "../../../../lib/contracts/constants";
import { DeadlineCountdown } from "../../../components/DeadlineCountdown";
import { ClaimRoyalties } from "../../../components/ClaimRoyalties";
import { WriterTradingStats } from "../../../components/WriterTradingStats";
import { WriterIdentityClient } from "../../../components/WriterIdentityClient";
import Link from "next/link";
import { ConnectWallet } from "../../../components/ConnectWallet";
import { type Address } from "viem";

async function fetchWriterStorylines(
  address: string,
): Promise<Storyline[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("storylines")
    .select("*")
    .eq("writer_address", address.toLowerCase())
    .eq("hidden", false)
    .order("block_timestamp", { ascending: false })
    .returns<Storyline[]>();
  if (error) throw error;
  return data ?? [];
}

export default function WriterDashboard() {
  const { address, isConnected } = useAccount();

  const { data: storylines = [], isLoading, error } = useQuery({
    queryKey: ["writer-storylines", address],
    queryFn: () => fetchWriterStorylines(address!),
    enabled: isConnected && !!address,
  });

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

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-accent text-2xl font-bold tracking-tight">
        Writer Dashboard
      </h1>
      <p className="text-muted mt-2 text-sm">
        <WriterIdentityClient address={address!} />
        {" — "}
        {storylines.length}{" "}
        {storylines.length === 1 ? "storyline" : "storylines"}
      </p>

      {isLoading && <p className="text-muted mt-8 text-sm">Loading...</p>}

      {error && (
        <p className="mt-8 text-sm text-red-400">
          Failed to load storylines. Please try again.
        </p>
      )}

      <div className="mt-8 space-y-4">
        {storylines.map((s) => (
          <StorylineDetail key={s.id} storyline={s} writerAddress={address!} />
        ))}
        {!isLoading && !error && storylines.length === 0 && (
          <p className="text-muted py-8 text-center text-sm">
            No storylines yet.
          </p>
        )}
      </div>
    </div>
  );
}

function StorylineDetail({ storyline, writerAddress }: { storyline: Storyline; writerAddress: Address }) {
  return (
    <div className="border-border rounded border px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/story/${storyline.storyline_id}`}
          className="text-foreground hover:text-accent text-sm font-medium transition-colors"
        >
          {storyline.title}
        </Link>
        {storyline.sunset && (
          <span className="text-muted border-border bg-surface shrink-0 rounded border px-2 py-0.5 text-[10px]">
            complete
          </span>
        )}
      </div>

      <div className="text-muted mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="block text-[10px] uppercase tracking-wider">
            Plots
          </span>
          <span className="text-foreground">{storyline.plot_count}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wider">
            Created
          </span>
          <span className="text-foreground">
            {storyline.block_timestamp
              ? new Date(storyline.block_timestamp).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", year: "numeric" },
                )
              : "—"}
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wider">
            Donations
          </span>
          {storyline.token_address
            ? <DonationCount storylineId={storyline.storyline_id} tokenAddress={storyline.token_address} />
            : <span className="text-foreground">—</span>
          }
        </div>
      </div>

      {!storyline.sunset &&
        storyline.has_deadline &&
        storyline.last_plot_time && (
          <DeadlineCountdown lastPlotTime={storyline.last_plot_time} />
        )}

      {storyline.token_address && (
        <>
          <WriterTradingStats storyline={storyline} />
          <ClaimRoyalties
            tokenAddress={storyline.token_address as Address}
            plotCount={storyline.plot_count}
            beneficiary={writerAddress}
          />
        </>
      )}
    </div>
  );
}

function DonationCount({ storylineId, tokenAddress }: { storylineId: number; tokenAddress: string }) {
  const { data } = useQuery({
    queryKey: ["donation-count", storylineId, tokenAddress],
    queryFn: async () => {
      const [tvlData, rows] = await Promise.all([
        getTokenTVL(tokenAddress as Address),
        supabase
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase.from("donations") as any)
              .select("amount")
              .eq("storyline_id", storylineId)
              .then((r: { data: { amount: string }[] | null }) => r.data)
          : null,
      ]);
      const decimals = tvlData?.decimals ?? 18;
      if (!rows || rows.length === 0) return { total: BigInt(0), count: 0, decimals };
      const total = (rows as { amount: string }[]).reduce(
        (sum, d) => sum + BigInt(d.amount),
        BigInt(0),
      );
      return { total, count: rows.length, decimals };
    },
  });

  if (!data || data.count === 0) {
    return <span className="text-foreground">—</span>;
  }

  return (
    <span className="text-foreground">
      {formatUnits(data.total, data.decimals)} {RESERVE_LABEL} <span className="text-muted">({data.count})</span>
    </span>
  );
}
