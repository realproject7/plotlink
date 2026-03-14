import { createServerClient, type Storyline } from "../../../lib/supabase";
import { StoryCard } from "../../components/StoryCard";
import { TabNav } from "../../components/TabNav";
import { publicClient } from "../../../lib/rpc";
import { erc20Abi } from "../../../lib/price";
import { type Address } from "viem";

type SearchParams = Promise<{ tab?: string }>;

const TABS = ["new", "trending", "rising", "completed"] as const;
type Tab = (typeof TABS)[number];

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "new";

  const supabase = createServerClient();
  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted text-sm">Database unavailable</p>
      </div>
    );
  }

  const storylines = await queryTab(supabase, tab);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-accent text-2xl font-bold tracking-tight">
        Discover
      </h1>
      <p className="text-muted mt-2 text-sm">Browse stories on PlotLink</p>

      <TabNav tabs={TABS} active={tab} className="mt-6" />

      {tab === "rising" && (
        <p className="text-muted mt-4 text-xs italic">
          Acceleration ranking requires a trades indexer — showing recent active stories.
        </p>
      )}

      <div className="mt-6 space-y-3">
        {storylines.map((s) => (
          <StoryCard key={s.id} storyline={s} genre="fiction" />
        ))}
        {storylines.length === 0 && (
          <p className="text-muted py-8 text-center text-sm">
            No stories found.
          </p>
        )}
      </div>
    </div>
  );
}

/** Read totalSupply for a token, returns 0 on failure */
async function readSupply(tokenAddress: string): Promise<bigint> {
  try {
    return await publicClient.readContract({
      address: tokenAddress as Address,
      abi: erc20Abi,
      functionName: "totalSupply",
    });
  } catch {
    return BigInt(0);
  }
}

async function queryTab(
  supabase: ReturnType<typeof createServerClient> & object,
  tab: Tab,
): Promise<Storyline[]> {
  switch (tab) {
    case "new": {
      const { data } = await supabase
        .from("storylines")
        .select("*")
        .eq("hidden", false)
        .eq("sunset", false)
        .order("block_timestamp", { ascending: false })
        .limit(50)
        .returns<Storyline[]>();
      return data ?? [];
    }

    case "completed": {
      const { data } = await supabase
        .from("storylines")
        .select("*")
        .eq("hidden", false)
        .eq("sunset", true)
        .order("plot_count", { ascending: false })
        .limit(50)
        .returns<Storyline[]>();
      return data ?? [];
    }

    case "trending": {
      // Composite ranking using available on-chain + DB signals:
      //   - totalSupply (on-chain minting volume)
      //   - plot_count (content engagement)
      //   - recency bonus (newer stories weighted higher)
      // Full composite (unique buyers, holder diversity) requires a trades
      // indexer — will replace these proxies when that exists.
      const { data: allStorylines } = await supabase
        .from("storylines")
        .select("*")
        .eq("hidden", false)
        .eq("sunset", false)
        .returns<Storyline[]>();

      const storylines = allStorylines ?? [];
      const withTokens = storylines.filter((s) => s.token_address);
      if (withTokens.length === 0) {
        return storylines
          .sort((a, b) => (b.block_timestamp ?? "").localeCompare(a.block_timestamp ?? ""))
          .slice(0, 50);
      }

      const supplies = await Promise.all(
        withTokens.map((s) => readSupply(s.token_address)),
      );

      const maxSupply = supplies.reduce((a, b) => (a > b ? a : b), BigInt(1));
      const now = Date.now();

      const scored = withTokens
        .map((s, i) => {
          // Normalize supply to 0-100
          const supplyScore = Number((supplies[i] * BigInt(100)) / maxSupply);
          // Content engagement: plot_count (capped at 20 for normalization)
          const plotScore = Math.min(s.plot_count, 20) * 5;
          // Recency: bonus for stories created in last 14 days
          const ageMs = s.block_timestamp
            ? now - new Date(s.block_timestamp).getTime()
            : now;
          const ageDays = ageMs / (1000 * 60 * 60 * 24);
          const recencyScore = ageDays < 14 ? Math.round((14 - ageDays) * 3) : 0;

          return {
            storyline: s,
            score: supplyScore + plotScore + recencyScore,
          };
        })
        .filter((s) => s.score > 0);

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, 50).map((s) => s.storyline);
    }

    case "rising": {
      // Full acceleration ranking (recent vs prior period trading activity)
      // requires a trades indexer. Falling back to recently active stories
      // with tokens (stories with supply > 0, ordered by recency).
      const { data: allStorylines } = await supabase
        .from("storylines")
        .select("*")
        .eq("hidden", false)
        .eq("sunset", false)
        .order("block_timestamp", { ascending: false })
        .returns<Storyline[]>();

      const storylines = allStorylines ?? [];
      const withTokens = storylines.filter((s) => s.token_address);
      if (withTokens.length === 0) {
        return storylines.slice(0, 50);
      }

      // Filter to stories with active supply (any minting activity)
      const supplies = await Promise.all(
        withTokens.map((s) => readSupply(s.token_address)),
      );

      const active = withTokens.filter((_, i) => supplies[i] > BigInt(0));
      if (active.length === 0) {
        return storylines.slice(0, 50);
      }

      return active.slice(0, 50);
    }
  }
}
