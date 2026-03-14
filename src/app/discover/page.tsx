import { createServerClient, type Storyline, type Donation } from "../../../lib/supabase";
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
      // Fetch active storylines with token addresses
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

      // Read on-chain totalSupply (trading volume proxy) for each token
      const supplies = await Promise.all(
        withTokens.map((s) => readSupply(s.token_address)),
      );

      // Fetch recent unique buyers (donation donors as buyer proxy) in last 7 days
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: donations } = await supabase
        .from("donations")
        .select("storyline_id, donor_address")
        .gte("block_timestamp", since)
        .returns<Pick<Donation, "storyline_id" | "donor_address">[]>();

      const donorMap = new Map<number, Set<string>>();
      for (const d of donations ?? []) {
        const set = donorMap.get(d.storyline_id) ?? new Set<string>();
        set.add(d.donor_address);
        donorMap.set(d.storyline_id, set);
      }

      // Composite score: normalized supply + 2 * unique buyers
      const maxSupply = supplies.reduce((a, b) => (a > b ? a : b), BigInt(1));
      const scored = withTokens.map((s, i) => ({
        storyline: s,
        score:
          Number((supplies[i] * BigInt(100)) / maxSupply) +
          2 * (donorMap.get(s.storyline_id)?.size ?? 0),
      }));

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, 50).map((s) => s.storyline);
    }

    case "rising": {
      // Fetch active storylines with tokens
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

      // Compare trading activity (donations as proxy) in last 3 days vs prior 3 days
      const now = Date.now();
      const recentSince = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
      const priorSince = new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString();

      const { data: recentDonations } = await supabase
        .from("donations")
        .select("storyline_id")
        .gte("block_timestamp", recentSince)
        .returns<Pick<Donation, "storyline_id">[]>();

      const { data: priorDonations } = await supabase
        .from("donations")
        .select("storyline_id")
        .gte("block_timestamp", priorSince)
        .lt("block_timestamp", recentSince)
        .returns<Pick<Donation, "storyline_id">[]>();

      const recentCounts = new Map<number, number>();
      for (const d of recentDonations ?? []) {
        recentCounts.set(d.storyline_id, (recentCounts.get(d.storyline_id) ?? 0) + 1);
      }

      const priorCounts = new Map<number, number>();
      for (const d of priorDonations ?? []) {
        priorCounts.set(d.storyline_id, (priorCounts.get(d.storyline_id) ?? 0) + 1);
      }

      // Score by acceleration: recent - prior
      const accelerating: { storyline: Storyline; accel: number }[] = [];
      for (const s of withTokens) {
        const recent = recentCounts.get(s.storyline_id) ?? 0;
        const prior = priorCounts.get(s.storyline_id) ?? 0;
        const accel = recent - prior;
        if (accel > 0 || (recent > 0 && prior === 0)) {
          accelerating.push({ storyline: s, accel: accel > 0 ? accel : recent });
        }
      }

      if (accelerating.length === 0) {
        // Fallback: newest with tokens
        return withTokens
          .sort((a, b) => (b.block_timestamp ?? "").localeCompare(a.block_timestamp ?? ""))
          .slice(0, 50);
      }

      accelerating.sort((a, b) => b.accel - a.accel);
      return accelerating.slice(0, 50).map((a) => a.storyline);
    }
  }
}
