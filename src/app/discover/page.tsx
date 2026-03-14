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
      // Rank by on-chain totalSupply (minted token volume = trading activity)
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

      // Read on-chain totalSupply for each storyline token
      const supplies = await Promise.all(
        withTokens.map((s) => readSupply(s.token_address)),
      );

      // Rank by totalSupply descending (higher supply = more trading activity)
      const scored = withTokens
        .map((s, i) => ({ storyline: s, supply: supplies[i] }))
        .filter((s) => s.supply > BigInt(0));

      scored.sort((a, b) =>
        a.supply > b.supply ? -1 : a.supply < b.supply ? 1 : 0,
      );

      return scored.slice(0, 50).map((s) => s.storyline);
    }

    case "rising": {
      // Rank by supply growth rate: totalSupply / age (newer stories with high
      // supply are rising faster than older ones with the same supply)
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

      const now = Date.now();
      const scored = withTokens
        .map((s, i) => {
          const supply = supplies[i];
          if (supply === BigInt(0)) return null;
          // Age in hours (min 1 to avoid division by zero)
          const ageMs = s.block_timestamp
            ? now - new Date(s.block_timestamp).getTime()
            : now;
          const ageHours = Math.max(ageMs / (1000 * 60 * 60), 1);
          // Growth rate = supply per hour (normalized)
          const rate = Number(supply) / ageHours;
          return { storyline: s, rate };
        })
        .filter((s): s is { storyline: Storyline; rate: number } => s !== null);

      scored.sort((a, b) => b.rate - a.rate);
      return scored.slice(0, 50).map((s) => s.storyline);
    }
  }
}
