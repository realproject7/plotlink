"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { supabase, type Storyline, type Donation } from "../../../../lib/supabase";
import { getTokenTVL } from "../../../../lib/price";
import { browserClient } from "../../../../lib/rpc";
import { RESERVE_LABEL, STORY_FACTORY, EXPLORER_URL } from "../../../../lib/contracts/constants";
import { GENRES, LANGUAGES } from "../../../../lib/genres";
import { DeadlineCountdown } from "../../../components/DeadlineCountdown";
import { ClaimRoyalties } from "../../../components/ClaimRoyalties";
import { WriterTradingStats } from "../../../components/WriterTradingStats";
import { WriterIdentityClient } from "../../../components/WriterIdentityClient";
import { DropdownSelect } from "../../../components/DropdownSelect";
import { truncateAddress } from "../../../../lib/utils";
import { formatPrice } from "../../../../lib/format";
import Link from "next/link";
import { ConnectWallet } from "../../../components/ConnectWallet";
import { type Address } from "viem";

function formatViewCountDashboard(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1000000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1000000).toFixed(1)}M`;
}

async function fetchWriterStorylines(
  address: string,
): Promise<Storyline[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("storylines")
    .select("*")
    .eq("writer_address", address.toLowerCase())
    .eq("hidden", false)
    .eq("contract_address", STORY_FACTORY.toLowerCase())
    .order("block_timestamp", { ascending: false })
    .returns<Storyline[]>();
  if (error) throw error;
  return data ?? [];
}

const genreOptions = [
  { value: "", label: "Select genre..." },
  ...GENRES.map((g) => ({ value: g, label: g })),
];
const languageOptions = LANGUAGES.map((l) => ({ value: l, label: l }));

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
      <h1 className="font-body text-2xl font-bold tracking-tight text-accent">
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
        <p className="mt-8 text-sm text-error">
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

      {!storyline.genre && (
        <GenrePrompt
          storylineId={storyline.storyline_id}
          language={storyline.language}
          writerAddress={writerAddress}
        />
      )}

      <div className="text-muted mt-3 grid grid-cols-4 gap-2 text-xs">
        <div>
          <span className="block text-[10px] uppercase tracking-wider">
            Plots
          </span>
          <span className="text-foreground">{storyline.plot_count}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wider">
            Views
          </span>
          <span className="text-foreground">{formatViewCountDashboard(storyline.view_count)}</span>
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
            <DonationsTooltip />
          </span>
          {storyline.token_address
            ? <DonationCount storylineId={storyline.storyline_id} tokenAddress={storyline.token_address} />
            : <span className="text-foreground">—</span>
          }
        </div>
      </div>

      {!storyline.sunset && storyline.last_plot_time && (
        <DeadlineCountdown lastPlotTime={storyline.last_plot_time} />
      )}

      {storyline.token_address && (
        <div className="mt-3 space-y-2">
          <WriterTradingStats storyline={storyline} />
          <ClaimRoyalties
            tokenAddress={storyline.token_address as Address}
            plotCount={storyline.plot_count}
            beneficiary={writerAddress}
          />
        </div>
      )}

      <WriterDonationHistory storylineId={storyline.storyline_id} />
    </div>
  );
}

const DONATION_PAGE_SIZE = 10;

function WriterDonationHistory({ storylineId }: { storylineId: number }) {
  const {
    data,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ["writer-donations", storylineId],
    queryFn: async ({ pageParam = 0 }) => {
      if (!supabase) return { rows: [] as Donation[], totalCount: 0 };
      const { data: rows, count } = await supabase
        .from("donations")
        .select("*", { count: "exact" })
        .eq("storyline_id", storylineId)
        .eq("contract_address", STORY_FACTORY.toLowerCase())
        .order("block_timestamp", { ascending: false })
        .range(pageParam, pageParam + DONATION_PAGE_SIZE - 1)
        .returns<Donation[]>();
      return { rows: rows ?? [], totalCount: count ?? 0 };
    },
    initialPageParam: 0,
    getNextPageParam: (_lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, p) => sum + p.rows.length, 0);
      const totalCount = allPages[0]?.totalCount ?? 0;
      return totalFetched < totalCount ? totalFetched : undefined;
    },
  });

  const donations = data?.pages.flatMap((p) => p.rows) ?? [];
  const totalCount = data?.pages[0]?.totalCount ?? 0;

  if (donations.length === 0) return null;

  return (
    <div className="mt-3">
      <span className="text-muted block text-[10px] uppercase tracking-wider">
        Donation History
      </span>
      <div className="mt-1 space-y-1">
        {donations.map((d) => (
          <div
            key={d.id}
            className="text-muted flex items-center justify-between text-[10px]"
          >
            <div className="flex gap-2">
              <a
                href={`/profile/${d.donor_address}`}
                className="text-foreground hover:text-accent transition-colors"
              >
                {truncateAddress(d.donor_address)}
              </a>
              {d.block_timestamp && (
                <time dateTime={d.block_timestamp}>
                  {new Date(d.block_timestamp).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-accent font-medium">
                {formatPrice(formatUnits(BigInt(d.amount), 18))} {RESERVE_LABEL}
              </span>
              {d.tx_hash && (
                <a
                  href={`${EXPLORER_URL}/tx/${d.tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted hover:text-accent transition-colors"
                  title="View on Basescan"
                >
                  &#x2197;
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="text-accent hover:text-foreground mt-2 w-full text-center text-[10px] transition-colors disabled:opacity-50"
        >
          {isFetchingNextPage ? "Loading..." : `Load more (${totalCount - donations.length} remaining)`}
        </button>
      )}
    </div>
  );
}

function GenrePrompt({
  storylineId,
  language,
  writerAddress,
}: {
  storylineId: number;
  language: string;
  writerAddress: string;
}) {
  const [genre, setGenre] = useState("");
  const [lang, setLang] = useState(language || "English");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { signMessageAsync } = useSignMessage();

  async function handleSave() {
    if (!genre) return;
    setSaving(true);
    setErr(null);
    try {
      const langValue = language ? "" : lang;
      const message = `Update storyline ${storylineId} metadata genre:${genre} language:${langValue}`;
      const signature = await signMessageAsync({ message });

      const res = await fetch(`/api/storyline/${storylineId}/metadata`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre,
          ...(language ? {} : { language: lang }),
          address: writerAddress,
          signature,
          message,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error (${res.status})`);
      }
      queryClient.invalidateQueries({ queryKey: ["writer-storylines"] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-accent/30 bg-surface mt-2 rounded border px-3 py-2.5">
      <p className="text-foreground text-xs font-medium">
        Set your genre
        <span className="text-muted font-normal">
          {" — "}improve discoverability by categorizing your story.
        </span>
      </p>
      <div className="mt-2 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <DropdownSelect
            value={genre}
            onChange={setGenre}
            options={genreOptions}
            placeholder="Select genre..."
            disabled={saving}
          />
        </div>
        {!language && (
          <div className="min-w-0 flex-1">
            <DropdownSelect
              value={lang}
              onChange={setLang}
              options={languageOptions}
              disabled={saving}
            />
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={!genre || saving}
          className="border-accent text-accent hover:bg-accent hover:text-background shrink-0 rounded border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
      {err && <p className="text-error mt-1 text-[10px]">{err}</p>}
    </div>
  );
}

function DonationCount({ storylineId, tokenAddress }: { storylineId: number; tokenAddress: string }) {
  const { data } = useQuery({
    queryKey: ["donation-count", storylineId, tokenAddress],
    queryFn: async () => {
      const [tvlData, rows] = await Promise.all([
        getTokenTVL(tokenAddress as Address, browserClient),
        supabase
          ? supabase.from("donations")
              .select("amount")
              .eq("storyline_id", storylineId)
              .eq("contract_address", STORY_FACTORY.toLowerCase())
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

function DonationsTooltip() {
  const [show, setShow] = useState(false);
  return (
    <span className="relative ml-1 inline-block">
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-muted hover:text-foreground text-[10px] leading-none transition-colors"
        aria-label="Donation info"
      >
        &#9432;
      </button>
      {show && (
        <span className="border-border bg-surface absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 rounded border px-3 py-2 text-[10px] leading-relaxed shadow-lg">
          <span className="text-foreground font-medium">Donations</span>
          <br />
          <span className="text-muted">
            Sent directly to your wallet when donors contribute. Already in your account — no claiming needed.
          </span>
        </span>
      )}
    </span>
  );
}
