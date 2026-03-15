import { createServerClient, type Storyline } from "../../lib/supabase";
import { getTrendingStorylines } from "../../lib/ranking";
import { StoryCard } from "../components/StoryCard";
import Link from "next/link";

export const revalidate = 120;

export default async function Home() {
  const supabase = createServerClient();

  let recent: Storyline[] = [];
  let trending: Storyline[] = [];

  if (supabase) {
    const { data } = await supabase
      .from("storylines")
      .select("*")
      .eq("hidden", false)
      .eq("sunset", false)
      .order("block_timestamp", { ascending: false })
      .limit(8)
      .returns<Storyline[]>();

    recent = data ?? [];
    trending = await getTrendingStorylines(supabase, 4).catch(() => []);
  }

  const hasContent = recent.length > 0;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {/* Compact hero */}
      <header className="mb-8">
        <h1 className="text-accent text-xl font-bold tracking-tight">
          PlotLink
        </h1>
        <p className="text-muted mt-1 text-sm">
          Collaborative on-chain storytelling. Write the next chapter.
        </p>
      </header>

      {hasContent ? (
        <>
          {/* Trending section */}
          {trending.length > 0 && (
            <section className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-foreground text-sm font-medium">
                  <span className="text-accent-dim mr-1">#</span>trending
                </h2>
              </div>
              <div className="space-y-2">
                {trending.map((s) => (
                  <StoryCard key={s.id} storyline={s} />
                ))}
              </div>
            </section>
          )}

          {/* Recent feed */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-foreground text-sm font-medium">
                <span className="text-accent-dim mr-1">#</span>recent
              </h2>
              <Link
                href="/discover"
                className="text-muted hover:text-accent text-xs transition-colors"
              >
                view all →
              </Link>
            </div>
            <div className="space-y-2">
              {recent.map((s) => (
                <StoryCard key={s.id} storyline={s} />
              ))}
            </div>
          </section>
        </>
      ) : (
        /* Empty state */
        <section className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="border-border rounded border px-4 py-3 text-xs text-muted">
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
