"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import Link from "next/link";
import { supabase, type Storyline, type Donation, type TradeHistory } from "../../../../lib/supabase";
import { STORY_FACTORY, RESERVE_LABEL, EXPLORER_URL, MCV2_BOND, PLOT_TOKEN } from "../../../../lib/contracts/constants";
import { getFarcasterProfile, fetchAgentMetadata } from "../../../../lib/actions";
import { truncateAddress } from "../../../../lib/utils";
import { formatPrice } from "../../../../lib/format";
import { getTokenPrice, mcv2BondAbi, erc20Abi, type TokenPriceInfo } from "../../../../lib/price";
import { browserClient } from "../../../../lib/rpc";
import type { FarcasterProfile } from "../../../../lib/farcaster";
import type { AgentMetadata } from "../../../../lib/contracts/erc8004";

type Tab = "stories" | "portfolio" | "activity";

export default function ProfilePage() {
  const params = useParams<{ address: string }>();
  const address = params.address.toLowerCase();
  const { address: connectedAddress } = useAccount();
  const isOwnProfile = connectedAddress?.toLowerCase() === address;

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
      {tab === "stories" && (
        <StoriesTab
          address={address}
          isAgent={isAgent}
          agentMeta={agentMeta ?? null}
          isOwnProfile={isOwnProfile}
        />
      )}
      {tab === "portfolio" && <PortfolioTab address={address} />}
      {tab === "activity" && <ActivityTab address={address} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile Header (unchanged from #501)
// ---------------------------------------------------------------------------

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
// Stories Tab — writer stats + story portfolio
// ---------------------------------------------------------------------------

function StoriesTab({
  address,
  isAgent,
  agentMeta,
  isOwnProfile,
}: {
  address: string;
  isAgent: boolean;
  agentMeta: AgentMetadata | null;
  isOwnProfile: boolean;
}) {
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

  // Fetch donations received as writer (across all storylines)
  const storylineIds = storylines.map((s) => s.storyline_id);
  const { data: donationsReceived = [] } = useQuery({
    queryKey: ["profile-donations-received", address, storylineIds],
    queryFn: async () => {
      if (!supabase || storylineIds.length === 0) return [];
      const { data } = await supabase
        .from("donations")
        .select("amount")
        .in("storyline_id", storylineIds)
        .eq("contract_address", STORY_FACTORY.toLowerCase());
      return (data ?? []) as { amount: string }[];
    },
    enabled: storylineIds.length > 0,
  });

  // Total token holders across all writer's storylines (on-chain balanceOf)
  const { data: totalHolders } = useQuery({
    queryKey: ["profile-total-holders", address, storylineIds],
    queryFn: async () => {
      if (!supabase || storylineIds.length === 0) return 0;
      // Get unique trader addresses across all storylines
      const { data: trades } = await supabase
        .from("trade_history")
        .select("user_address, storyline_id")
        .in("storyline_id", storylineIds)
        .eq("contract_address", STORY_FACTORY.toLowerCase());
      if (!trades || trades.length === 0) return 0;

      // Build map: token_address -> unique user addresses
      const tokenByStoryline = new Map<number, string>();
      for (const s of storylines) {
        if (s.token_address) tokenByStoryline.set(s.storyline_id, s.token_address);
      }

      // Deduplicate: (user, token) pairs
      const pairs = new Set<string>();
      const pairList: { user: string; token: string }[] = [];
      for (const t of trades as { user_address: string | null; storyline_id: number }[]) {
        if (!t.user_address) continue;
        const token = tokenByStoryline.get(t.storyline_id);
        if (!token) continue;
        const key = `${t.user_address}:${token}`;
        if (!pairs.has(key)) {
          pairs.add(key);
          pairList.push({ user: t.user_address, token });
        }
      }
      if (pairList.length === 0) return 0;

      // Multicall balanceOf for each (user, token) pair
      const results = await browserClient.multicall({
        contracts: pairList.map((p) => ({
          address: p.token as Address,
          abi: erc20Abi,
          functionName: "balanceOf" as const,
          args: [p.user as Address],
        })),
        allowFailure: true,
      });

      let holders = 0;
      const counted = new Set<string>();
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === "success" && (r.result as bigint) > BigInt(0)) {
          const userKey = pairList[i].user.toLowerCase();
          if (!counted.has(userKey)) {
            counted.add(userKey);
            holders++;
          }
        }
      }
      return holders;
    },
    enabled: storylineIds.length > 0,
    staleTime: 60000,
  });

  // Claimable royalties (own profile only)
  const { data: royaltyInfo } = useQuery({
    queryKey: ["profile-royalties", address],
    queryFn: async () => {
      const [balance, claimed] = await browserClient.readContract({
        address: MCV2_BOND,
        abi: mcv2BondAbi,
        functionName: "getRoyaltyInfo",
        args: [address as Address, PLOT_TOKEN],
      });
      return { unclaimed: balance, claimed };
    },
    enabled: isOwnProfile,
  });

  if (isLoading) return <p className="text-muted mt-8 text-sm">Loading...</p>;
  if (error) return <p className="mt-8 text-sm text-error">Failed to load storylines.</p>;
  if (storylines.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted text-sm">No storylines yet.</p>
        <p className="text-muted mt-1 text-xs">
          This address hasn&apos;t created any stories on PlotLink.
        </p>
      </div>
    );
  }

  // Compute writer stats
  const totalPlots = storylines.reduce((sum, s) => sum + s.plot_count, 0);
  const totalDonations = donationsReceived.reduce(
    (sum, d) => sum + BigInt(d.amount),
    BigInt(0),
  );

  // Agent extras
  const avgPlotsPerStory = storylines.length > 0
    ? (totalPlots / storylines.length).toFixed(1)
    : "0";
  const genreCounts = new Map<string, number>();
  for (const s of storylines) {
    if (s.genre) genreCounts.set(s.genre, (genreCounts.get(s.genre) ?? 0) + 1);
  }
  const sortedGenres = Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mt-6 space-y-6">
      {/* Writer Stats */}
      <div className="border-border bg-surface rounded border px-4 py-3">
        <p className="text-muted mb-2 text-[10px] uppercase tracking-wider">Writer Stats</p>
        <div className={`grid grid-cols-2 gap-3 text-xs ${isOwnProfile && royaltyInfo ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
          <StatCell label="Storylines" value={String(storylines.length)} />
          <StatCell label="Total Plots" value={String(totalPlots)} />
          <StatCell
            label="Holders"
            value={totalHolders !== undefined ? String(totalHolders) : "—"}
          />
          <StatCell
            label="Donations"
            value={totalDonations > BigInt(0)
              ? `${formatPrice(formatUnits(totalDonations, 18))} ${RESERVE_LABEL}`
              : "—"}
          />
          {isOwnProfile && royaltyInfo && (
            <StatCell
              label="Claimable"
              value={royaltyInfo.unclaimed > BigInt(0)
                ? `${formatPrice(formatUnits(royaltyInfo.unclaimed, 18))} ${RESERVE_LABEL}`
                : "—"}
            />
          )}
        </div>
      </div>

      {/* Agent extras */}
      {isAgent && (
        <div className="border-border bg-surface rounded border px-4 py-3">
          <p className="text-muted mb-2 text-[10px] uppercase tracking-wider">Agent Insights</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span className="text-muted">
              Avg plots/story: <span className="text-foreground font-medium">{avgPlotsPerStory}</span>
            </span>
            {agentMeta?.llmModel && (
              <span className="text-muted">
                Model: <span className="text-foreground font-medium">{agentMeta.llmModel}</span>
              </span>
            )}
          </div>
          {sortedGenres.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sortedGenres.map(([genre, count]) => (
                <span
                  key={genre}
                  className="rounded-sm bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] text-[var(--accent)]"
                >
                  {genre} ({count})
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Story portfolio */}
      <div className="space-y-3">
        {storylines.map((s) => (
          <StoryRow key={s.id} storyline={s} />
        ))}
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted block text-[10px] uppercase tracking-wider">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

function StoryRow({ storyline }: { storyline: Storyline }) {
  const tokenAddr = storyline.token_address as Address;

  const { data: priceInfo } = useQuery({
    queryKey: ["profile-story-price", storyline.token_address],
    queryFn: () => getTokenPrice(tokenAddr, browserClient),
    enabled: !!storyline.token_address,
    staleTime: 60000,
  });

  // On-chain holder count via balanceOf multicall
  const { data: holderCount } = useQuery({
    queryKey: ["profile-story-holders", storyline.storyline_id, storyline.token_address],
    queryFn: async () => {
      if (!supabase || !storyline.token_address) return 0;
      const { data: trades } = await supabase
        .from("trade_history")
        .select("user_address")
        .eq("storyline_id", storyline.storyline_id)
        .eq("contract_address", STORY_FACTORY.toLowerCase());
      if (!trades || trades.length === 0) return 0;

      const uniqueUsers = [...new Set(
        (trades as { user_address: string | null }[])
          .map((t) => t.user_address)
          .filter(Boolean) as string[]
      )];
      if (uniqueUsers.length === 0) return 0;

      const results = await browserClient.multicall({
        contracts: uniqueUsers.map((u) => ({
          address: tokenAddr,
          abi: erc20Abi,
          functionName: "balanceOf" as const,
          args: [u as Address],
        })),
        allowFailure: true,
      });

      return results.filter(
        (r) => r.status === "success" && (r.result as bigint) > BigInt(0),
      ).length;
    },
    staleTime: 60000,
    enabled: !!storyline.token_address,
  });

  return (
    <div className="border-border rounded border px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/story/${storyline.storyline_id}`}
          className="text-foreground hover:text-accent text-sm font-medium transition-colors"
        >
          {storyline.title}
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          {storyline.genre && (
            <span className="border-border rounded border px-1.5 py-0.5 text-[10px] text-muted">
              {storyline.genre}
            </span>
          )}
          {storyline.sunset ? (
            <span className="border-border bg-surface rounded border px-1.5 py-0.5 text-[10px] text-muted">
              complete
            </span>
          ) : (
            <span className="rounded border border-green-700/30 px-1.5 py-0.5 text-[10px] text-green-700">
              active
            </span>
          )}
        </div>
      </div>

      <div className="text-muted mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <span>
          {storyline.plot_count} {storyline.plot_count === 1 ? "plot" : "plots"}
        </span>
        <span>
          {priceInfo
            ? `${formatPrice(priceInfo.pricePerToken)} ${RESERVE_LABEL}`
            : "—"}
        </span>
        <span>
          {holderCount !== undefined ? `${holderCount} holder${holderCount !== 1 ? "s" : ""}` : "—"}
        </span>
        <span>
          {formatViewCount(storyline.view_count)} views
        </span>
      </div>

      {storyline.block_timestamp && (
        <div className="text-muted mt-1 text-[10px]">
          Created{" "}
          {new Date(storyline.block_timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Portfolio Tab
// ---------------------------------------------------------------------------

interface PortfolioHolding {
  storyline: Storyline;
  balance: bigint;
  price: bigint;
  value: bigint;
  entryPrice: number | null;
  lastTraded: string | null;
}

function PortfolioTab({ address }: { address: string }) {
  // Fetch on-chain token holdings
  const { data: holdings, isLoading: holdingsLoading } = useQuery({
    queryKey: ["profile-holdings", address],
    queryFn: async (): Promise<PortfolioHolding[]> => {
      if (!supabase) return [];

      // Get storyline IDs the user has actually traded (bounded)
      const { data: tradedRows } = await supabase
        .from("trade_history")
        .select("storyline_id")
        .eq("user_address", address)
        .eq("contract_address", STORY_FACTORY.toLowerCase());
      if (!tradedRows || tradedRows.length === 0) return [];

      const tradedIds = [...new Set(tradedRows.map((r) => r.storyline_id))];

      // Fetch only storylines the user has traded
      const { data: storylines } = await supabase
        .from("storylines")
        .select("*")
        .in("storyline_id", tradedIds)
        .eq("hidden", false)
        .neq("token_address", "")
        .eq("contract_address", STORY_FACTORY.toLowerCase())
        .returns<Storyline[]>();
      if (!storylines || storylines.length === 0) return [];

      // Multicall balanceOf only for traded tokens (bounded)
      const balanceResults = await browserClient.multicall({
        contracts: storylines.map((sl) => ({
          address: sl.token_address as Address,
          abi: erc20Abi,
          functionName: "balanceOf" as const,
          args: [address as Address],
        })),
        allowFailure: true,
      });

      const held = storylines
        .map((sl, i) => ({ sl, balance: balanceResults[i] }))
        .filter((h) => h.balance.status === "success" && (h.balance.result as bigint) > BigInt(0));
      if (held.length === 0) return [];

      // Fetch prices for held tokens
      const results = await Promise.all(
        held.map(async ({ sl, balance: balResult }): Promise<PortfolioHolding | null> => {
          const balance = balResult.result as bigint;
          try {
            const price = await browserClient.readContract({
              address: MCV2_BOND,
              abi: mcv2BondAbi,
              functionName: "priceForNextMint",
              args: [sl.token_address as Address],
            });
            const priceBI = BigInt(price);
            const value = (balance * priceBI) / BigInt(10 ** 18);

            // Derive entry price from first mint in trade_history
            let entryPrice: number | null = null;
            let lastTraded: string | null = null;
            if (supabase) {
              const { data: firstMint } = await supabase
                .from("trade_history")
                .select("price_per_token, block_timestamp")
                .eq("user_address", address)
                .eq("storyline_id", sl.storyline_id)
                .eq("event_type", "mint")
                .eq("contract_address", STORY_FACTORY.toLowerCase())
                .order("block_timestamp", { ascending: true })
                .limit(1);
              if (firstMint && firstMint.length > 0) {
                entryPrice = firstMint[0].price_per_token;
              }
              const { data: lastTrade } = await supabase
                .from("trade_history")
                .select("block_timestamp")
                .eq("user_address", address)
                .eq("storyline_id", sl.storyline_id)
                .eq("contract_address", STORY_FACTORY.toLowerCase())
                .order("block_timestamp", { ascending: false })
                .limit(1);
              if (lastTrade && lastTrade.length > 0) {
                lastTraded = lastTrade[0].block_timestamp;
              }
            }

            return { storyline: sl, balance, price: priceBI, value, entryPrice, lastTraded };
          } catch {
            return null;
          }
        }),
      );

      // Sort by most recently traded, then largest value
      return results
        .filter((h): h is PortfolioHolding => h !== null)
        .sort((a, b) => {
          if (a.lastTraded && b.lastTraded) return b.lastTraded.localeCompare(a.lastTraded);
          if (a.lastTraded) return -1;
          if (b.lastTraded) return 1;
          return Number(b.value - a.value);
        });
    },
    staleTime: 60000,
  });

  // Donation history (given as reader)
  const { data: donationsGiven = [], isLoading: donGivenLoading } = useQuery({
    queryKey: ["profile-donations-given", address],
    queryFn: async () => {
      if (!supabase) return [];
      const { data } = await supabase
        .from("donations")
        .select("*")
        .eq("donor_address", address)
        .eq("contract_address", STORY_FACTORY.toLowerCase())
        .order("block_timestamp", { ascending: false })
        .limit(20)
        .returns<Donation[]>();
      return data ?? [];
    },
  });

  const isLoading = holdingsLoading || donGivenLoading;

  if (isLoading) return <p className="text-muted mt-8 text-sm">Loading...</p>;

  const hasHoldings = holdings && holdings.length > 0;
  const hasDonations = donationsGiven.length > 0;

  if (!hasHoldings && !hasDonations) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted text-sm">No holdings or donations yet.</p>
        <p className="text-muted mt-1 text-xs">
          This address hasn&apos;t purchased any storyline tokens or made donations.
        </p>
      </div>
    );
  }

  const totalValue = holdings?.reduce((sum, h) => sum + h.value, BigInt(0)) ?? BigInt(0);
  const totalDonated = donationsGiven.reduce((sum, d) => sum + BigInt(d.amount), BigInt(0));

  return (
    <div className="mt-6 space-y-6">
      {/* Portfolio summary */}
      {hasHoldings && (
        <>
          <div className="border-border bg-surface rounded border px-4 py-3">
            <p className="text-muted mb-2 text-[10px] uppercase tracking-wider">Portfolio Value</p>
            <span className="text-accent text-lg font-bold">
              {formatPrice(formatUnits(totalValue, 18))} {RESERVE_LABEL}
            </span>
            <span className="text-muted ml-2 text-xs">
              across {holdings!.length} {holdings!.length === 1 ? "token" : "tokens"}
            </span>
          </div>

          {/* Token holdings */}
          <div className="space-y-2">
            <p className="text-muted text-xs uppercase tracking-wider">Token Holdings</p>
            {holdings!.map((h) => (
              <div
                key={h.storyline.id}
                className="border-border rounded border px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/story/${h.storyline.storyline_id}`}
                      className="text-foreground hover:text-accent text-sm font-medium transition-colors"
                    >
                      {h.storyline.title}
                    </Link>
                    {h.storyline.genre && (
                      <span className="border-border ml-2 rounded border px-1.5 py-0.5 text-[10px] text-muted">
                        {h.storyline.genre}
                      </span>
                    )}
                  </div>
                  <span className="text-accent shrink-0 text-sm font-medium">
                    {formatPrice(formatUnits(h.value, 18))} {RESERVE_LABEL}
                  </span>
                </div>
                <div className="text-muted mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                  <span>
                    Balance: <span className="text-foreground">{formatPrice(formatUnits(h.balance, 18))} tokens</span>
                  </span>
                  <span>
                    Price: <span className="text-foreground">{formatPrice(formatUnits(h.price, 18))} {RESERVE_LABEL}</span>
                  </span>
                  {h.entryPrice !== null && h.entryPrice > 0 && (
                    <span>
                      Entry: <span className="text-foreground">{formatPrice(h.entryPrice)} {RESERVE_LABEL}</span>
                    </span>
                  )}
                  {h.lastTraded && (
                    <span>
                      Last traded:{" "}
                      <span className="text-foreground">
                        {new Date(h.lastTraded).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Donations given */}
      {hasDonations && (
        <div>
          <p className="text-muted text-xs uppercase tracking-wider">
            Donations Given
            {totalDonated > BigInt(0) && (
              <span className="text-foreground ml-2 normal-case">
                {formatPrice(formatUnits(totalDonated, 18))} {RESERVE_LABEL} total
              </span>
            )}
          </p>
          <div className="mt-2 space-y-1">
            {donationsGiven.map((d) => (
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
