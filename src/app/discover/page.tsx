import { createServerClient, type Storyline, type Donation } from "../../../lib/supabase";
import { StoryCard } from "../../components/StoryCard";
import { TabNav } from "../../components/TabNav";

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

interface DonationAgg {
  storyline_id: number;
  donation_count: number;
  unique_donors: number;
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
      // Composite ranking: donation count + unique donors in last 7 days
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: donations } = await supabase
        .from("donations")
        .select("storyline_id, donor_address")
        .gte("block_timestamp", since)
        .returns<Pick<Donation, "storyline_id" | "donor_address">[]>();

      // Aggregate per storyline
      const aggMap = new Map<number, { count: number; donors: Set<string> }>();
      for (const d of donations ?? []) {
        const entry = aggMap.get(d.storyline_id) ?? { count: 0, donors: new Set<string>() };
        entry.count++;
        entry.donors.add(d.donor_address);
        aggMap.set(d.storyline_id, entry);
      }

      const ranked: DonationAgg[] = [];
      for (const [storyline_id, entry] of aggMap) {
        ranked.push({
          storyline_id,
          donation_count: entry.count,
          unique_donors: entry.donors.size,
        });
      }

      // Composite score: donation_count + 2 * unique_donors (diversity weighted)
      ranked.sort(
        (a, b) =>
          b.donation_count + 2 * b.unique_donors -
          (a.donation_count + 2 * a.unique_donors),
      );

      const topIds = ranked.slice(0, 50).map((r) => r.storyline_id);
      if (topIds.length === 0) {
        // Fallback to newest if no trading activity
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

      const { data: storylines } = await supabase
        .from("storylines")
        .select("*")
        .eq("hidden", false)
        .in("storyline_id", topIds)
        .returns<Storyline[]>();

      // Re-sort by ranked order
      const idOrder = new Map(topIds.map((id, i) => [id, i]));
      return (storylines ?? []).sort(
        (a, b) => (idOrder.get(a.storyline_id) ?? 99) - (idOrder.get(b.storyline_id) ?? 99),
      );
    }

    case "rising": {
      // Acceleration: more donations in last 3 days vs prior 3 days
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

      // Count per storyline in each period
      const recentCounts = new Map<number, number>();
      for (const d of recentDonations ?? []) {
        recentCounts.set(d.storyline_id, (recentCounts.get(d.storyline_id) ?? 0) + 1);
      }

      const priorCounts = new Map<number, number>();
      for (const d of priorDonations ?? []) {
        priorCounts.set(d.storyline_id, (priorCounts.get(d.storyline_id) ?? 0) + 1);
      }

      // Compute acceleration: recent - prior (only positive acceleration)
      const accelerating: { storyline_id: number; accel: number }[] = [];
      for (const [id, recent] of recentCounts) {
        const prior = priorCounts.get(id) ?? 0;
        const accel = recent - prior;
        if (accel > 0) {
          accelerating.push({ storyline_id: id, accel });
        }
      }

      accelerating.sort((a, b) => b.accel - a.accel);

      const topIds = accelerating.slice(0, 50).map((r) => r.storyline_id);
      if (topIds.length === 0) {
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

      const { data: storylines } = await supabase
        .from("storylines")
        .select("*")
        .eq("hidden", false)
        .in("storyline_id", topIds)
        .returns<Storyline[]>();

      const idOrder = new Map(topIds.map((id, i) => [id, i]));
      return (storylines ?? []).sort(
        (a, b) => (idOrder.get(a.storyline_id) ?? 99) - (idOrder.get(b.storyline_id) ?? 99),
      );
    }
  }
}
