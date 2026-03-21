"use client";

import { useAccount } from "wagmi";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { supabase, type Donation, type TradeHistory } from "../../../../lib/supabase";
import { formatPrice } from "../../../../lib/format";
import { ReaderPortfolio } from "../../../components/ReaderPortfolio";
import Link from "next/link";
import { WriterIdentityClient } from "../../../components/WriterIdentityClient";
import { formatUnits } from "viem";
import { ConnectWallet } from "../../../components/ConnectWallet";
import { RESERVE_LABEL, PLOT_TOKEN, STORY_FACTORY, EXPLORER_URL } from "../../../../lib/contracts/constants";
import { browserClient as publicClient } from "../../../../lib/rpc";
import { type Address } from "viem";

/** Truncate formatUnits output to at most `digits` decimal places */
function formatTruncated(value: bigint, decimals: number, digits = 6): string {
  const raw = formatUnits(value, decimals);
  const dot = raw.indexOf(".");
  if (dot === -1 || raw.length - dot - 1 <= digits) return raw;
  return raw.slice(0, dot + 1 + digits).replace(/0+$/, "").replace(/\.$/, "");
}

const PAGE_SIZE = 10;

export default function ReaderDashboard() {
  const { address, isConnected } = useAccount();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    error,
  } = useInfiniteQuery({
    queryKey: ["reader-donations", address],
    queryFn: async ({ pageParam = 0 }) => {
      if (!supabase) return { rows: [] as Donation[], totalCount: 0 };
      const { data: rows, count, error } = await supabase
        .from("donations")
        .select("*", { count: "exact" })
        .eq("donor_address", address!.toLowerCase())
        .eq("contract_address", STORY_FACTORY.toLowerCase())
        .order("block_timestamp", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1)
        .returns<Donation[]>();
      if (error) throw error;
      return { rows: rows ?? [], totalCount: count ?? 0 };
    },
    initialPageParam: 0,
    getNextPageParam: (_lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, p) => sum + p.rows.length, 0);
      const totalCount = allPages[0]?.totalCount ?? 0;
      return totalFetched < totalCount ? totalFetched : undefined;
    },
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

  const donations = data?.pages.flatMap((p) => p.rows) ?? [];
  const totalCount = data?.pages[0]?.totalCount ?? 0;

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

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-accent text-2xl font-bold tracking-tight">
        Reader Dashboard
      </h1>
      <p className="text-muted mt-2 text-sm">
        <WriterIdentityClient address={address!} />
      </p>

      <ReaderPortfolio />

      {/* --- Trading History --- */}
      <TradingHistory address={address!} />

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
              &middot; {formatTruncated(totalDonated, reserveDecimals)} {RESERVE_LABEL} total loaded
            </span>
          )}
        </p>

        {isLoading && <p className="text-muted mt-4 text-sm">Loading...</p>}

        {error && (
          <p className="mt-4 text-sm text-error">
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

        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="text-accent hover:text-foreground mt-4 w-full text-center text-xs transition-colors disabled:opacity-50"
          >
            {isFetchingNextPage ? "Loading..." : `Load more (${totalCount - donations.length} remaining)`}
          </button>
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
      <div className="flex items-center gap-2">
        <span className="text-accent font-medium">
          {formatTruncated(BigInt(donation.amount), decimals)} {RESERVE_LABEL}
        </span>
        {donation.tx_hash && (
          <a
            href={`${EXPLORER_URL}/tx/${donation.tx_hash}`}
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
  );
}

const TRADE_PAGE_SIZE = 10;

function TradingHistory({ address }: { address: string }) {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ["reader-trades", address],
    queryFn: async ({ pageParam = 0 }) => {
      if (!supabase) return { rows: [] as TradeHistory[], totalCount: 0 };
      const { data: rows, count } = await supabase
        .from("trade_history")
        .select("*", { count: "exact" })
        .eq("user_address", address.toLowerCase())
        .order("block_timestamp", { ascending: false })
        .range(pageParam, pageParam + TRADE_PAGE_SIZE - 1)
        .returns<TradeHistory[]>();
      return { rows: rows ?? [], totalCount: count ?? 0 };
    },
    initialPageParam: 0,
    getNextPageParam: (_lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, p) => sum + p.rows.length, 0);
      const totalCount = allPages[0]?.totalCount ?? 0;
      return totalFetched < totalCount ? totalFetched : undefined;
    },
  });

  const trades = data?.pages.flatMap((p) => p.rows) ?? [];
  const totalCount = data?.pages[0]?.totalCount ?? 0;

  return (
    <section className="mt-8">
      <h2 className="text-foreground text-sm font-medium">Trading History</h2>
      <p className="text-muted mt-1 text-xs">
        {totalCount} {totalCount === 1 ? "trade" : "trades"}
      </p>

      {isLoading && <p className="text-muted mt-4 text-sm">Loading...</p>}

      <div className="mt-4 space-y-2">
        {trades.map((t) => (
          <div
            key={`${t.tx_hash}-${t.log_index}`}
            className="border-border flex items-center justify-between rounded border px-3 py-2 text-xs"
          >
            <div className="text-muted flex gap-3">
              <span className={t.event_type === "mint" ? "text-accent font-medium" : "text-error font-medium"}>
                {t.event_type === "mint" ? "Buy" : "Sell"}
              </span>
              <Link
                href={`/story/${t.storyline_id}`}
                className="text-foreground hover:text-accent transition-colors"
              >
                Story #{t.storyline_id}
              </Link>
              {t.block_timestamp && (
                <time dateTime={t.block_timestamp}>
                  {new Date(t.block_timestamp).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              )}
            </div>
            <div className="flex items-center gap-2">
              {t.price_per_token > 0 && (
                <span className="text-muted">
                  {formatPrice(t.reserve_amount / t.price_per_token)} tokens
                </span>
              )}
              <span className="text-foreground">
                {formatPrice(t.reserve_amount)} {RESERVE_LABEL}
              </span>
              {t.tx_hash && (
                <a
                  href={`${EXPLORER_URL}/tx/${t.tx_hash}`}
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
        {!isLoading && trades.length === 0 && (
          <p className="text-muted py-6 text-center text-sm">
            No trades yet.
          </p>
        )}
      </div>

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="text-accent hover:text-foreground mt-4 w-full text-center text-xs transition-colors disabled:opacity-50"
        >
          {isFetchingNextPage ? "Loading..." : `Load more (${totalCount - trades.length} remaining)`}
        </button>
      )}
    </section>
  );
}
