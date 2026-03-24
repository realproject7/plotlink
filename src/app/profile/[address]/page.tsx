"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import Link from "next/link";
import { supabase, type Storyline, type Donation, type TradeHistory } from "../../../../lib/supabase";
import { STORY_FACTORY, RESERVE_LABEL, EXPLORER_URL } from "../../../../lib/contracts/constants";
import { getFarcasterProfile, fetchAgentMetadata } from "../../../../lib/actions";
import { truncateAddress } from "../../../../lib/utils";
import { formatPrice } from "../../../../lib/format";
import { AgentBadge } from "../../../components/AgentBadge";
import type { FarcasterProfile } from "../../../../lib/farcaster";
import type { AgentMetadata } from "../../../../lib/contracts/erc8004";

type Tab = "stories" | "portfolio" | "activity";

export default function ProfilePage() {
  const params = useParams<{ address: string }>();
  const address = params.address.toLowerCase();

  const [tab, setTab] = useState<Tab>("stories");

  const { data: fcProfile, isLoading: fcLoading } = useQuery({
    queryKey: ["fc-profile", address],
    queryFn: () => getFarcasterProfile(address),
  });

  const { data: agentMeta, isLoading: agentLoading } = useQuery({
    queryKey: ["agent-meta", address],
    queryFn: () => fetchAgentMetadata(address),
  });

  const isAgent = !agentLoading && agentMeta !== null && agentMeta !== undefined;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <ProfileHeader
        address={address}
        fcProfile={fcProfile ?? null}
        fcLoading={fcLoading}
        agentMeta={agentMeta ?? null}
        agentLoading={agentLoading}
        isAgent={isAgent}
      />

      {/* Tab navigation */}
      <div className="mt-8 flex gap-2 border-b border-[var(--border)] pb-2">
        {(["stories", "portfolio", "activity"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              tab === t
                ? "bg-accent/15 text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "stories" && <StoriesTab address={address} />}
      {tab === "portfolio" && <PortfolioTab address={address} />}
      {tab === "activity" && <ActivityTab address={address} />}
    </div>
  );
}

function ProfileHeader({
  address,
  fcProfile,
  fcLoading,
  agentMeta,
  agentLoading,
  isAgent,
}: {
  address: string;
  fcProfile: FarcasterProfile | null;
  fcLoading: boolean;
  agentMeta: AgentMetadata | null;
  agentLoading: boolean;
  isAgent: boolean;
}) {
  const displayName = agentMeta?.name ?? fcProfile?.displayName ?? null;

  return (
    <header className="border-border border-b pb-6">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        {fcProfile?.pfpUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fcProfile.pfpUrl}
            alt=""
            width={56}
            height={56}
            className="rounded-full"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--border)] text-lg font-bold text-[var(--text-muted)]">
            {address.slice(2, 4).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          {/* Name + badge */}
          <div className="flex items-center gap-2">
            <h1 className="font-body text-2xl font-bold tracking-tight text-accent truncate">
              {fcLoading && agentLoading
                ? truncateAddress(address)
                : displayName ?? truncateAddress(address)}
            </h1>
            {!agentLoading && (
              isAgent ? (
                <span className="border-accent-dim text-accent-dim rounded border px-1.5 py-0.5 text-[10px]">
                  AI Agent
                </span>
              ) : (
                <span className="border-border text-muted rounded border px-1.5 py-0.5 text-[10px]">
                  Human
                </span>
              )
            )}
          </div>

          {/* Secondary identity line */}
          <div className="text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {fcProfile && (
              <a
                href={`https://farcaster.xyz/${fcProfile.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-accent transition-colors"
              >
                @{fcProfile.username}
              </a>
            )}
            <a
              href={`${EXPLORER_URL}/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] hover:text-accent transition-colors"
            >
              {truncateAddress(address)}
            </a>
          </div>

          {/* Agent metadata */}
          {agentMeta && (
            <div className="text-muted mt-2 space-y-0.5 text-xs">
              {agentMeta.description && (
                <p>{agentMeta.description}</p>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {agentMeta.llmModel && (
                  <span>Model: <span className="text-foreground">{agentMeta.llmModel}</span></span>
                )}
                {agentMeta.genre && (
                  <span>Genre: <span className="text-foreground">{agentMeta.genre}</span></span>
                )}
                {agentMeta.registeredAt && (
                  <span>Registered: <span className="text-foreground">
                    {new Date(agentMeta.registeredAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span></span>
                )}
              </div>
            </div>
          )}

          {/* Farcaster bio (only show when no agent description is present) */}
          {!agentMeta?.description && fcProfile?.bio && (
            <p className="text-muted mt-1 text-xs">{fcProfile.bio}</p>
          )}
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Stories Tab
// ---------------------------------------------------------------------------

function StoriesTab({ address }: { address: string }) {
  const { data: storylines = [], isLoading, error } = useQuery({
    queryKey: ["profile-storylines", address],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from("storylines")
        .select("*")
        .eq("writer_address", address)
        .eq("hidden", false)
        .eq("contract_address", STORY_FACTORY.toLowerCase())
        .order("block_timestamp", { ascending: false })
        .returns<Storyline[]>();
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-muted mt-8 text-sm">Loading...</p>;
  if (error) return <p className="mt-8 text-sm text-error">Failed to load storylines.</p>;
  if (storylines.length === 0) {
    return <p className="text-muted py-8 text-center text-sm">No storylines yet.</p>;
  }

  return (
    <div className="mt-6 space-y-3">
      {storylines.map((s) => (
        <div key={s.id} className="border-border rounded border px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <Link
              href={`/story/${s.storyline_id}`}
              className="text-foreground hover:text-accent text-sm font-medium transition-colors"
            >
              {s.title}
            </Link>
            <div className="flex shrink-0 items-center gap-1.5">
              {s.genre && (
                <span className="border-border rounded border px-1.5 py-0.5 text-[10px] text-muted">
                  {s.genre}
                </span>
              )}
              {s.sunset && (
                <span className="border-border bg-surface rounded border px-1.5 py-0.5 text-[10px] text-muted">
                  complete
                </span>
              )}
            </div>
          </div>
          <div className="text-muted mt-2 flex gap-4 text-xs">
            <span>
              {s.plot_count} {s.plot_count === 1 ? "plot" : "plots"}
            </span>
            <span>{formatViewCount(s.view_count)} views</span>
            {s.block_timestamp && (
              <span>
                {new Date(s.block_timestamp).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Portfolio Tab
// ---------------------------------------------------------------------------

function PortfolioTab({ address }: { address: string }) {
  const { data: trades = [], isLoading, error } = useQuery({
    queryKey: ["profile-portfolio", address],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from("trade_history")
        .select("*")
        .eq("user_address", address)
        .eq("contract_address", STORY_FACTORY.toLowerCase())
        .order("block_timestamp", { ascending: false })
        .limit(50)
        .returns<TradeHistory[]>();
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-muted mt-8 text-sm">Loading...</p>;
  if (error) return <p className="mt-8 text-sm text-error">Failed to load portfolio.</p>;
  if (trades.length === 0) {
    return <p className="text-muted py-8 text-center text-sm">No trading activity yet.</p>;
  }

  // Group trades by storyline to show net position
  const positions = new Map<number, { storylineId: number; mints: number; burns: number; lastTrade: string }>();
  for (const t of trades) {
    const pos = positions.get(t.storyline_id) ?? { storylineId: t.storyline_id, mints: 0, burns: 0, lastTrade: t.block_timestamp };
    if (t.event_type === "mint") pos.mints++;
    else if (t.event_type === "burn") pos.burns++;
    positions.set(t.storyline_id, pos);
  }

  return (
    <div className="mt-6 space-y-3">
      <p className="text-muted text-xs uppercase tracking-wider">Trading Activity</p>
      {Array.from(positions.values()).map((pos) => (
        <div key={pos.storylineId} className="border-border rounded border px-4 py-3">
          <div className="flex items-center justify-between">
            <Link
              href={`/story/${pos.storylineId}`}
              className="text-foreground hover:text-accent text-sm font-medium transition-colors"
            >
              Story #{pos.storylineId}
            </Link>
            <span className="text-muted text-xs">
              {new Date(pos.lastTrade).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <div className="text-muted mt-1 flex gap-4 text-xs">
            <span className="text-green-700">{pos.mints} mint{pos.mints !== 1 ? "s" : ""}</span>
            <span className="text-red-700">{pos.burns} burn{pos.burns !== 1 ? "s" : ""}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity Tab
// ---------------------------------------------------------------------------

const ACTIVITY_PAGE_SIZE = 20;

function ActivityTab({ address }: { address: string }) {
  const { data: donations = [], isLoading: donLoading } = useQuery({
    queryKey: ["profile-donations", address],
    queryFn: async () => {
      if (!supabase) return [];
      const { data } = await supabase
        .from("donations")
        .select("*")
        .eq("donor_address", address)
        .eq("contract_address", STORY_FACTORY.toLowerCase())
        .order("block_timestamp", { ascending: false })
        .limit(ACTIVITY_PAGE_SIZE)
        .returns<Donation[]>();
      return data ?? [];
    },
  });

  const { data: ratings = [], isLoading: ratLoading } = useQuery({
    queryKey: ["profile-ratings", address],
    queryFn: async () => {
      if (!supabase) return [];
      const { data } = await supabase
        .from("ratings")
        .select("*")
        .eq("rater_address", address)
        .eq("contract_address", STORY_FACTORY.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(ACTIVITY_PAGE_SIZE);
      return data ?? [];
    },
  });

  const isLoading = donLoading || ratLoading;
  const hasActivity = donations.length > 0 || ratings.length > 0;

  if (isLoading) return <p className="text-muted mt-8 text-sm">Loading...</p>;
  if (!hasActivity) {
    return <p className="text-muted py-8 text-center text-sm">No activity yet.</p>;
  }

  return (
    <div className="mt-6 space-y-6">
      {donations.length > 0 && (
        <div>
          <p className="text-muted text-xs uppercase tracking-wider">Donations</p>
          <div className="mt-2 space-y-1">
            {donations.map((d) => (
              <div key={d.id} className="text-muted flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/story/${d.storyline_id}`}
                    className="text-foreground hover:text-accent transition-colors"
                  >
                    Story #{d.storyline_id}
                  </Link>
                  {d.block_timestamp && (
                    <time dateTime={d.block_timestamp} className="text-[10px]">
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
        </div>
      )}

      {ratings.length > 0 && (
        <div>
          <p className="text-muted text-xs uppercase tracking-wider">Ratings</p>
          <div className="mt-2 space-y-1">
            {ratings.map((r: { id: number; storyline_id: number; rating: number; comment: string | null; created_at: string }) => (
              <div key={r.id} className="text-muted flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/story/${r.storyline_id}`}
                    className="text-foreground hover:text-accent transition-colors"
                  >
                    Story #{r.storyline_id}
                  </Link>
                  <span className="text-accent">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                </div>
                <time dateTime={r.created_at} className="text-[10px]">
                  {new Date(r.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatViewCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1000000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1000000).toFixed(1)}M`;
}
