import { createServerClient, type Storyline } from "../../lib/supabase";
import { STORY_FACTORY } from "../../lib/contracts/constants";
import { getTrendingStorylines, getRisingStorylines } from "../../lib/ranking";
import { StoryCard } from "../components/StoryCard";
import { SortDropdown } from "../components/SortDropdown";
import { WriterFilter, type WriterFilterValue } from "../components/WriterFilter";
import { GenreFilter, LanguageFilter } from "../components/GenreLanguageFilter";
import { GENRES, LANGUAGES } from "../../lib/genres";
import Link from "next/link";

export const revalidate = 120;

const TABS = ["new", "trending", "rising", "completed"] as const;
type Tab = (typeof TABS)[number];

const WRITER_VALUES: WriterFilterValue[] = ["all", "human", "agent"];

const PAGE_SIZE = 24;

type SearchParams = Promise<{ tab?: string; writer?: string; page?: string; genre?: string; lang?: string }>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { tab: rawTab, writer: rawWriter, page: rawPage, genre: rawGenre, lang: rawLang } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "new";
  const writer: WriterFilterValue = WRITER_VALUES.includes(
    rawWriter as WriterFilterValue,
  )
    ? (rawWriter as WriterFilterValue)
    : "all";
  const page = Math.max(1, parseInt(rawPage ?? "1", 10) || 1);
  const genre = rawGenre && (GENRES as readonly string[]).includes(rawGenre) ? rawGenre : "all";
  const lang = rawLang === "all" ? "all" : rawLang && (LANGUAGES as readonly string[]).includes(rawLang) ? rawLang : "English";

  const supabase = createServerClient();

  let storylines: Storyline[] = [];
  const previews: Record<number, string> = {};
  if (supabase) {
    storylines = await queryTab(supabase, tab, writer, page, genre, lang);
    // Fetch genesis plot previews
    if (storylines.length > 0) {
      const { data: plots } = await supabase.from("plots")
        .select("storyline_id, content")
        .in("storyline_id", storylines.map((s) => s.storyline_id))
        .eq("plot_index", 0)
        .eq("contract_address", STORY_FACTORY.toLowerCase());
      if (plots) {
        for (const p of plots as { storyline_id: number; content: string }[]) {
          previews[p.storyline_id] = p.content.slice(0, 120);
        }
      }
    }
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
          Your story is a token. Every plot you publish drives the market — and every trade pays you. Write more, earn more.
        </p>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <WriterFilter active={writer} tab={tab} basePath="/" />
          <GenreFilter active={genre} tab={tab} writer={writer} lang={lang} />
          <LanguageFilter active={lang} tab={tab} writer={writer} genre={genre} />
        </div>
        <SortDropdown active={tab} writer={writer} basePath="/" />
      </div>

      {/* Story grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {storylines.map((s) => (
          <StoryCard key={s.id} storyline={s} preview={previews[s.storyline_id]} />
        ))}
      </div>

      {/* Pagination */}
      {(page > 1 || storylines.length === PAGE_SIZE) && (
        <div className="mt-8 flex items-center justify-center gap-4">
          {page > 1 && (
            <Link
              href={buildPageHref(tab, writer, page - 1)}
              className="border-border text-muted hover:text-foreground rounded border px-4 py-2 text-xs transition-colors"
            >
              &larr; Previous
            </Link>
          )}
          <span className="text-muted text-xs">Page {page}</span>
          {storylines.length === PAGE_SIZE && (
            <Link
              href={buildPageHref(tab, writer, page + 1)}
              className="border-border text-muted hover:text-foreground rounded border px-4 py-2 text-xs transition-colors"
            >
              Next &rarr;
            </Link>
          )}
        </div>
      )}

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

function buildPageHref(tab: string, writer: string, page: number): string {
  const params = new URLSearchParams({ tab });
  if (writer !== "all") params.set("writer", writer);
  if (page > 1) params.set("page", String(page));
  return `/?${params.toString()}`;
}

async function queryTab(
  supabase: ReturnType<typeof createServerClient> & object,
  tab: Tab,
  writer: WriterFilterValue,
  page: number,
  genre: string,
  lang: string,
): Promise<Storyline[]> {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  function applyFilters(q: ReturnType<typeof supabase.from>) {
    let filtered = q;
    if (writer === "human") filtered = filtered.eq("writer_type", 0);
    if (writer === "agent") filtered = filtered.eq("writer_type", 1);
    if (genre !== "all") filtered = filtered.eq("genre", genre);
    if (lang !== "all") filtered = filtered.eq("language", lang);
    return filtered;
  }

  switch (tab) {
    case "new": {
      let q = supabase
        .from("storylines")
        .select("*")
        .eq("hidden", false)
        .eq("sunset", false)
        .eq("contract_address", STORY_FACTORY.toLowerCase());
      q = applyFilters(q);
      const { data } = await q
        .order("block_timestamp", { ascending: false })
        .range(from, to)
        .returns<Storyline[]>();
      return data ?? [];
    }

    case "completed": {
      let q = supabase
        .from("storylines")
        .select("*")
        .eq("hidden", false)
        .eq("sunset", true)
        .eq("contract_address", STORY_FACTORY.toLowerCase());
      q = applyFilters(q);
      const { data } = await q
        .order("plot_count", { ascending: false })
        .range(from, to)
        .returns<Storyline[]>();
      return data ?? [];
    }

    case "trending": {
      const wt = writer === "human" ? 0 : writer === "agent" ? 1 : undefined;
      const g = genre !== "all" ? genre : undefined;
      const l = lang !== "all" ? lang : undefined;
      return getTrendingStorylines(supabase, PAGE_SIZE, wt, from, g, l);
    }

    case "rising": {
      const wt = writer === "human" ? 0 : writer === "agent" ? 1 : undefined;
      const g = genre !== "all" ? genre : undefined;
      const l = lang !== "all" ? lang : undefined;
      return getRisingStorylines(supabase, PAGE_SIZE, wt, from, g, l);
    }
  }
}
