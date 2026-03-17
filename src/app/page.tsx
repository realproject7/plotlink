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

  // Split first storyline as featured (only on first page, "new" or "trending" tab)
  const showFeatured = page === 1 && (tab === "new" || tab === "trending") && storylines.length > 0;
  const featured = showFeatured ? storylines[0] : null;
  const rest = showFeatured ? storylines.slice(1) : storylines;

  return (
    <div className="animate-in mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Hero */}
      <header className="mb-10 gen-pattern rounded-lg px-6 py-8">
        <h1 className="text-accent text-2xl font-bold tracking-tight sm:text-3xl">
          PlotLink
        </h1>
        <p className="text-muted mt-2 max-w-lg text-sm leading-relaxed">
          Your story is a token. Every plot you publish drives the market — and
          every trade pays you. Write more, earn more.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/create"
            className="border-accent text-accent hover:bg-accent hover:text-background rounded border px-4 py-1.5 text-xs font-medium transition-colors"
          >
            start writing
          </Link>
          <Link
            href="/discover"
            className="border-border text-muted hover:text-foreground rounded border px-4 py-1.5 text-xs transition-colors"
          >
            discover stories
          </Link>
        </div>
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

      {/* Featured + grid shelf */}
      {featured && (
        <section className="mt-8">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr]">
            {/* Featured card — spans the left side */}
            <div className="lg:row-span-2">
              <StoryCard
                storyline={featured}
                preview={previews[featured.storyline_id]}
                featured
              />
            </div>
            {/* Next stories fill the remaining grid */}
            {rest.slice(0, 4).map((s) => (
              <StoryCard
                key={s.id}
                storyline={s}
                preview={previews[s.storyline_id]}
              />
            ))}
          </div>
        </section>
      )}

      {/* Main story grid — book-cover layout */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {(featured ? rest.slice(4) : rest).map((s) => (
          <StoryCard
            key={s.id}
            storyline={s}
            preview={previews[s.storyline_id]}
          />
        ))}
      </div>

      {/* Pagination */}
      {(page > 1 || storylines.length === PAGE_SIZE) && (
        <div className="mt-10 flex items-center justify-center gap-4">
          {page > 1 && (
            <Link
              href={buildPageHref(tab, writer, page - 1)}
              className="border-border text-muted hover:text-foreground hover:border-accent-dim rounded border px-4 py-2 text-xs transition-colors"
            >
              &larr; Previous
            </Link>
          )}
          <span className="text-muted text-xs">Page {page}</span>
          {storylines.length === PAGE_SIZE && (
            <Link
              href={buildPageHref(tab, writer, page + 1)}
              className="border-border text-muted hover:text-foreground hover:border-accent-dim rounded border px-4 py-2 text-xs transition-colors"
            >
              Next &rarr;
            </Link>
          )}
        </div>
      )}

      {storylines.length === 0 && (
        <section className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="glow-border rounded border border-border px-5 py-4 text-xs text-muted">
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
