"use client";

import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { supabase, type Storyline } from "../../../../lib/supabase";
import { ConnectWallet } from "../../../components/ConnectWallet";
import { DeadlineCountdown } from "../../../components/DeadlineCountdown";
import Link from "next/link";

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
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
          <StorylineDetail key={s.id} storyline={s} />
        ))}
        {!isLoading && storylines.length === 0 && (
          <p className="text-muted py-8 text-center text-sm">
            No storylines yet.
          </p>
        )}
      </div>
    </div>
  );
}

function StorylineDetail({ storyline }: { storyline: Storyline }) {
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
            Deadline
          </span>
          <span className="text-foreground">
            {storyline.has_deadline ? "72h" : "none"}
          </span>
        </div>
      </div>

      {!storyline.sunset &&
        storyline.has_deadline &&
        storyline.last_plot_time && (
          <DeadlineCountdown lastPlotTime={storyline.last_plot_time} />
        )}
    </div>
  );
}
