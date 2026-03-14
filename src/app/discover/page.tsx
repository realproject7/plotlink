import { createServerClient, type Storyline } from "../../../lib/supabase";
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

  let storylines: Storyline[] = [];

  if (tab === "completed") {
    const { data } = await supabase
      .from("storylines")
      .select("*")
      .eq("hidden", false)
      .eq("sunset", true)
      .order("plot_count", { ascending: false })
      .limit(50)
      .returns<Storyline[]>();
    storylines = data ?? [];
  } else {
    // "new" is the default; "trending" and "rising" fall back to "new" ordering
    // until trading data is available (Phase 5)
    const { data } = await supabase
      .from("storylines")
      .select("*")
      .eq("hidden", false)
      .eq("sunset", false)
      .order("block_timestamp", { ascending: false })
      .limit(50)
      .returns<Storyline[]>();
    storylines = data ?? [];
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-accent text-2xl font-bold tracking-tight">
        Discover
      </h1>
      <p className="text-muted mt-2 text-sm">
        Browse stories on PlotLink
      </p>

      <TabNav tabs={TABS} active={tab} className="mt-6" />

      {(tab === "trending" || tab === "rising") && (
        <p className="text-muted mt-4 text-xs italic">
          Ranking by recency — trading-based ranking available after Phase 5.
        </p>
      )}

      <div className="mt-6 space-y-3">
        {storylines.map((s) => (
          <StoryCard key={s.id} storyline={s} />
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
