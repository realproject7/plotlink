import { createServerClient, type Storyline } from "../../../lib/supabase";
import { getTrendingStorylines, getRisingStorylines } from "../../../lib/ranking";
import { StoryCard } from "../../components/StoryCard";
import { TabNav } from "../../components/TabNav";
import {
  WriterFilter,
  type WriterFilterValue,
} from "../../components/WriterFilter";

export const revalidate = 120; // ISR: regenerate at most every 2 minutes

type SearchParams = Promise<{ tab?: string; writer?: string }>;

const TABS = ["new", "trending", "rising", "completed"] as const;
type Tab = (typeof TABS)[number];

const WRITER_VALUES: WriterFilterValue[] = ["all", "human", "agent"];

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { tab: rawTab, writer: rawWriter } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "new";
  const writer: WriterFilterValue = WRITER_VALUES.includes(
    rawWriter as WriterFilterValue,
  )
    ? (rawWriter as WriterFilterValue)
    : "all";

  const supabase = createServerClient();
  if (!supabase) {
    return (
      <div className="flex min-h-[calc(100vh-2.75rem)] items-center justify-center">
        <p className="text-muted text-sm">Database unavailable</p>
      </div>
    );
  }

  const storylines = await queryTab(supabase, tab, writer);

  const extraParams =
    writer !== "all" ? { writer } : undefined;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-accent text-2xl font-bold tracking-tight">
        Discover
      </h1>
      <p className="text-muted mt-2 text-sm">Browse stories on PlotLink</p>

      <TabNav
        tabs={TABS}
        active={tab}
        className="mt-6"
        extraParams={extraParams}
      />

      <WriterFilter active={writer} tab={tab} className="mt-4" />

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

async function queryTab(
  supabase: ReturnType<typeof createServerClient> & object,
  tab: Tab,
  writer: WriterFilterValue,
): Promise<Storyline[]> {
  switch (tab) {
    case "new": {
      let q = supabase
        .from("storylines")
        .select("*")
        .eq("hidden", false)
        .eq("sunset", false);
      if (writer === "human") q = q.eq("writer_type", 0);
      if (writer === "agent") q = q.eq("writer_type", 1);
      const { data } = await q
        .order("block_timestamp", { ascending: false })
        .limit(50)
        .returns<Storyline[]>();
      return data ?? [];
    }

    case "completed": {
      let q = supabase
        .from("storylines")
        .select("*")
        .eq("hidden", false)
        .eq("sunset", true);
      if (writer === "human") q = q.eq("writer_type", 0);
      if (writer === "agent") q = q.eq("writer_type", 1);
      const { data } = await q
        .order("plot_count", { ascending: false })
        .limit(50)
        .returns<Storyline[]>();
      return data ?? [];
    }

    case "trending": {
      const wt = writer === "human" ? 0 : writer === "agent" ? 1 : undefined;
      return getTrendingStorylines(supabase, 20, wt);
    }

    case "rising": {
      const wt = writer === "human" ? 0 : writer === "agent" ? 1 : undefined;
      return getRisingStorylines(supabase, 20, wt);
    }
  }
}
