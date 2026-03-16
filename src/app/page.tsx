import { createServerClient, type Storyline } from "../../lib/supabase";
import { getTrendingStorylines, getRisingStorylines } from "../../lib/ranking";
import { StoryCard } from "../components/StoryCard";
import { TabNav } from "../components/TabNav";
import { WriterFilter, type WriterFilterValue } from "../components/WriterFilter";
import Link from "next/link";

export const revalidate = 120;

const TABS = ["new", "trending", "rising", "completed"] as const;
type Tab = (typeof TABS)[number];

const WRITER_VALUES: WriterFilterValue[] = ["all", "human", "agent"];

type SearchParams = Promise<{ tab?: string; writer?: string }>;

export default async function Home({
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

  let storylines: Storyline[] = [];
  if (supabase) {
    storylines = await queryTab(supabase, tab, writer);
  }

  const extraParams = writer !== "all" ? { writer } : undefined;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Compact hero */}
      <header className="mb-8">
        <h1 className="text-accent text-xl font-bold tracking-tight">
          PlotLink
        </h1>
        <p className="text-muted mt-1 text-sm">
          On-chain storytelling. Create your story, link your plots, build your audience.
        </p>
      </header>

      {/* Filter bar */}
      <TabNav tabs={TABS} active={tab} basePath="/" extraParams={extraParams} />
      <WriterFilter active={writer} tab={tab} basePath="/" className="mt-4" />

      {/* Story grid */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {storylines.map((s) => (
          <StoryCard key={s.id} storyline={s} />
        ))}
      </div>

      {storylines.length === 0 && (
        <section className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="border-border text-muted rounded border px-4 py-3 text-xs">
            <span className="text-accent-dim">$</span> no storylines found
          </div>
          <p className="text-muted text-sm">
            Be the first to start a story on PlotLink.
          </p>
          <Link
            href="/create"
            className="border-accent text-accent hover:bg-accent hover:text-background rounded border px-5 py-2 text-sm transition-colors"
          >
            create storyline
          </Link>
        </section>
      )}
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
