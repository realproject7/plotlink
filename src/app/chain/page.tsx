"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import {
  validateContentLength,
  MIN_CONTENT_LENGTH,
  MAX_CONTENT_LENGTH,
} from "../../../lib/content";
import { supabase, type Storyline } from "../../../lib/supabase";
import { useChainPlot } from "../../hooks/useChainPlot";
import type { PublishState } from "../../hooks/usePublish";
import Link from "next/link";
import { ConnectWallet } from "../../components/ConnectWallet";
import { Select } from "../../components/Select";

const STATE_LABELS: Record<PublishState, string> = {
  idle: "",
  uploading: "Uploading to IPFS...",
  confirming: "Confirm in wallet...",
  pending: "Publishing to Base...",
  indexing: "Indexing...",
  published: "Published!",
  error: "Error",
};

async function fetchWriterStorylines(address: string): Promise<Storyline[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("storylines")
    .select("*")
    .eq("writer_address", address.toLowerCase())
    .eq("hidden", false)
    .eq("sunset", false)
    .order("block_timestamp", { ascending: false })
    .returns<Storyline[]>();
  return data ?? [];
}

export default function ChainPlotPage() {
  const { address, isConnected } = useAccount();
  const [storylineId, setStorylineId] = useState<number | null>(null);
  const [content, setContent] = useState("");

  const { data: storylines = [], isLoading: loadingStorylines } = useQuery({
    queryKey: ["writer-active-storylines", address],
    queryFn: () => fetchWriterStorylines(address!),
    enabled: isConnected && !!address,
  });

  const { state, error, chainPlot, reset } = useChainPlot();
  const { valid, charCount } = validateContentLength(content);
  const canSubmit =
    (state === "idle" || state === "error") &&
    storylineId !== null &&
    valid;

  if (!isConnected) {
    return (
      <div className="flex min-h-[calc(100vh-2.75rem)] flex-col items-center justify-center gap-4 px-6">
        <p className="text-muted text-sm">
          Connect your wallet to chain a plot.
        </p>
        <ConnectWallet />
      </div>
    );
  }

  if (state === "published") {
    return (
      <div className="flex min-h-[calc(100vh-2.75rem)] flex-col items-center justify-center gap-6 px-6">
        <h1 className="text-accent text-2xl font-bold">Plot chained!</h1>
        <div className="flex gap-3">
          {storylineId && (
            <Link
              href={`/story/${storylineId}`}
              className="border-border text-muted hover:text-foreground rounded border px-4 py-2 text-sm transition-colors"
            >
              View story
            </Link>
          )}
          <button
            onClick={reset}
            className="border-accent text-accent hover:bg-accent hover:text-background rounded border px-4 py-2 text-sm transition-colors"
          >
            Chain another
          </button>
        </div>
      </div>
    );
  }

  const busy = state !== "idle" && state !== "error";

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-accent text-2xl font-bold tracking-tight">
        Chain Plot
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) chainPlot(storylineId, content);
        }}
        className="mt-8 space-y-6"
      >
        {/* Storyline selector */}
        <div>
          <label className="text-foreground mb-2 block text-sm">
            Storyline
          </label>
          {loadingStorylines ? (
            <p className="text-muted text-sm">Loading storylines...</p>
          ) : storylines.length === 0 ? (
            <p className="text-muted text-sm">
              No active storylines.{" "}
              <Link href="/create" className="text-accent hover:underline">
                Create one
              </Link>
            </p>
          ) : (
            <Select
              value={storylineId != null ? String(storylineId) : ""}
              onChange={(v) => setStorylineId(v ? Number(v) : null)}
              disabled={busy}
              placeholder="Select a storyline"
              options={storylines.map((s) => ({
                value: String(s.storyline_id),
                label: `${s.title} (${s.plot_count} ${s.plot_count === 1 ? "plot" : "plots"})`,
              }))}
            />
          )}
        </div>

        {/* Content */}
        <div>
          <label className="text-foreground mb-2 block text-sm">
            Next Chapter
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={busy}
            rows={12}
            placeholder="Write the next plot (500–10,000 characters)"
            className="border-border bg-surface text-foreground placeholder:text-muted w-full resize-y rounded border px-3 py-2 text-sm leading-relaxed focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <div className="mt-1 text-xs">
            <span
              className={
                content.length > 0 && !valid ? "text-error" : "text-muted"
              }
            >
              {charCount.toLocaleString()} /{" "}
              {MIN_CONTENT_LENGTH.toLocaleString()}–
              {MAX_CONTENT_LENGTH.toLocaleString()} chars
            </span>
          </div>
        </div>

        {/* Status */}
        {state === "error" && (
          <div className="border-error/30 text-error rounded border px-3 py-2 text-xs">
            {error}
          </div>
        )}
        {busy && (
          <div className="border-border text-muted rounded border px-3 py-2 text-xs">
            {STATE_LABELS[state]}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit || busy}
          className="border-accent text-accent hover:bg-accent hover:text-background w-full rounded border py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {busy ? STATE_LABELS[state] : "Chain Plot"}
        </button>
      </form>
    </div>
  );
}
