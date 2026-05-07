import { type Metadata } from "next";
import { Suspense } from "react";
import { createServerClient, type Storyline, type Plot } from "../../../../lib/supabase";
import { DeadlineCountdown } from "../../../components/DeadlineCountdown";
import { AddPlotButton } from "../../../components/AddPlotButton";
import { TradingWidget } from "../../../components/TradingWidget";
import { PriceChart } from "../../../components/PriceChart";
import { DonateWidget } from "../../../components/DonateWidget";
import { RatingWidget } from "../../../components/RatingWidget";
import { RatingSummary } from "../../../components/RatingSummary";
import { ShareButtons } from "../../../components/ShareButtons";
import { StoryContent } from "../../../components/StoryContent";
import { ReadingModeWrapper } from "../../../components/ReadingModeWrapper";
import { getTokenPrice, type TokenPriceInfo } from "../../../../lib/price";
import { RESERVE_LABEL, STORY_FACTORY } from "../../../../lib/contracts/constants";
import { formatPrice, formatSupply } from "../../../../lib/format";
import { type Address } from "viem";
import { truncateAddress } from "../../../../lib/utils";
import Link from "next/link";
import { AgentBadge } from "../../../components/AgentBadge";
import { WriterIdentity } from "../../../components/WriterIdentity";
import { ViewCount, ViewTracker } from "../../../components/ViewCount";
import { CommentSection } from "../../../components/CommentSection";
import { MobileActionBar } from "../../../components/MobileActionBar";
import { MarketCapBox } from "../../../components/MarketCapBox";
import { TokenPriceBox } from "../../../components/TokenPriceBox";

/** Deduplicate plots by plot_index, keeping the first occurrence. */
function deduplicateByPlotIndex(plots: Plot[]) {
  const seen = new Set<number>();
  return plots
    .filter((p) => {
      if (seen.has(p.plot_index)) return false;
      seen.add(p.plot_index);
      return true;
    })
    .map((p) => ({
      plotIndex: p.plot_index,
      title: p.title || (p.plot_index === 0 ? "Genesis" : `Chapter ${p.plot_index}`),
      content: p.content,
    }));
}

type Params = Promise<{ storylineId: string }>;

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { storylineId } = await params;
  const id = Number(storylineId);

  if (isNaN(id) || id <= 0) return {};

  const supabase = createServerClient();
  if (!supabase) return {};

  const { data: storyline } = await supabase
    .from("storylines")
    .select("*")
    .eq("storyline_id", id)
    .eq("hidden", false)
    .eq("contract_address", STORY_FACTORY.toLowerCase())
    .single();

  if (!storyline) return {};

  const sl = storyline as Storyline;
  const ogImageUrl = `${appUrl}/story/${id}/og`;
  const storyUrl = `${appUrl}/story/${id}`;

  const priceInfo = sl.token_address
    ? await getTokenPrice(sl.token_address as Address)
    : null;
  const reserveLabel = RESERVE_LABEL;
  const priceSuffix = priceInfo
    ? ` — Price: ${formatPrice(priceInfo.pricePerToken)} ${reserveLabel}`
    : "";
  const description = `An on-chain story by ${truncateAddress(sl.writer_address)} — ${sl.plot_count} ${sl.plot_count === 1 ? "plot" : "plots"}${priceSuffix}`;

  const fcEmbed = JSON.stringify({
    version: "1",
    imageUrl: ogImageUrl,
    button: {
      title: "Read Story",
      action: {
        type: "launch_miniapp",
        url: storyUrl,
        name: "PlotLink",
        splashBackgroundColor: "#faf8f5",
      },
    },
  });

  return {
    title: `${sl.title} — PlotLink`,
    description,
    openGraph: {
      title: sl.title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: sl.title,
      description,
      images: [ogImageUrl],
    },
    other: {
      "fc:miniapp": fcEmbed,
    },
  };
}

export default async function StoryPage({ params }: { params: Params }) {
  const { storylineId } = await params;
  const id = Number(storylineId);

  if (isNaN(id) || id <= 0) {
    return <NotFound message="Invalid storyline ID" />;
  }

  const supabase = createServerClient();
  if (!supabase) {
    return <NotFound message="Database unavailable" />;
  }

  const { data: storyline } = await supabase
    .from("storylines")
    .select("*")
    .eq("storyline_id", id)
    .eq("hidden", false)
    .eq("contract_address", STORY_FACTORY.toLowerCase())
    .single();

  if (!storyline) {
    return <NotFound message="Storyline not found" />;
  }

  const { data: plotRows } = await supabase
    .from("plots")
    .select("*")
    .eq("storyline_id", id)
    .eq("hidden", false)
    .eq("contract_address", STORY_FACTORY.toLowerCase())
    .order("plot_index", { ascending: true })
    .returns<Plot[]>();

  const plots = plotRows ?? [];
  const genesis = plots.find((p) => p.plot_index === 0) ?? null;
  const chapters = plots.filter((p) => p.plot_index > 0);

  const sl = storyline as Storyline;
  const priceInfo = sl.token_address
    ? await getTokenPrice(sl.token_address as Address)
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-24 lg:pb-10">
      <ViewTracker storylineId={id} />

      {/* Breadcrumb */}
      <nav className="text-muted mb-6 text-xs">
        <Link href="/" className="hover:text-accent transition-colors">Stories</Link>
        <span className="mx-2">›</span>
        <span className="text-foreground">{sl.title}</span>
      </nav>

      <StoryHeader storyline={storyline} priceInfo={priceInfo} storylineId={id} />

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        {/* Story content — genesis + table of contents */}
        <main className="min-w-0">
          {genesis ? (
            <>
              <GenesisSection
                plot={genesis}
                readingMode={
                  <ReadingModeWrapper
                    storylineId={id}
                    storylineTitle={sl.title}
                    chapters={deduplicateByPlotIndex(plots)}
                    initialPlotIndex={0}
                  />
                }
              />
              {chapters.length > 0 && (
                <a
                  href={`/story/${id}/1`}
                  className="border-accent text-accent hover:bg-accent/10 mt-8 block w-full rounded border py-3 text-center text-sm font-medium transition-colors"
                >
                  Read the first Plot
                </a>
              )}
              <CommentSection storylineId={id} plotIndex={0} />
            </>
          ) : (
            <p className="text-muted text-sm">No plots yet.</p>
          )}

          {chapters.length > 0 && (
            <TableOfContents
              storylineId={id}
              chapters={chapters}
            />
          )}

          {/* Share buttons — below chapters */}
          <div className="mt-6">
            <ShareButtons storylineId={id} title={sl.title} />
          </div>
        </main>

        {/* Sidebar — desktop only */}
        <aside className="hidden space-y-4 lg:block">
          {sl.token_address && priceInfo && (
            <PriceChart
              tokenAddress={sl.token_address as Address}
              currentPriceRaw={priceInfo.priceRaw}
            />
          )}
          {sl.token_address && (
            <TradingWidget tokenAddress={sl.token_address as Address} />
          )}
          <DonateWidget storylineId={id} writerAddress={sl.writer_address} />
          {sl.token_address && (
            <RatingWidget storylineId={id} tokenAddress={sl.token_address} />
          )}
        </aside>
      </div>

      {/* Mobile floating bottom bar */}
      <MobileActionBar
        tradeContent={
          sl.token_address ? (
            <>
              {priceInfo && (
                <PriceChart
                  tokenAddress={sl.token_address as Address}
                  currentPriceRaw={priceInfo.priceRaw}
                />
              )}
              <TradingWidget tokenAddress={sl.token_address as Address} />
            </>
          ) : undefined
        }
        donateContent={
          <DonateWidget storylineId={id} writerAddress={sl.writer_address} />
        }
        rateContent={
          sl.token_address ? (
            <RatingWidget storylineId={id} tokenAddress={sl.token_address} />
          ) : undefined
        }
      />
    </div>
  );
}

type FallbackVariant = "A" | "B" | "C" | "D";

function hashToVariant(id: number): FallbackVariant {
  const variants: FallbackVariant[] = ["A", "B", "C", "D"];
  return variants[((id * 2654435761) >>> 0) % 4];
}

const FALLBACK_STYLES: Record<FallbackVariant, React.CSSProperties> = {
  A: { background: "radial-gradient(circle at 30% 70%, oklch(30% 0.06 28 / 0.5) 0%, transparent 60%), linear-gradient(160deg, oklch(22% 0.03 50) 0%, oklch(16% 0.025 30) 100%)" },
  B: { background: "repeating-linear-gradient(-45deg, oklch(20% 0.02 50) 0px, oklch(20% 0.02 50) 2px, oklch(23% 0.025 50) 2px, oklch(23% 0.025 50) 12px)" },
  C: { background: "conic-gradient(from 45deg at 80% 20%, oklch(25% 0.04 280 / 0.3), transparent 120deg), linear-gradient(180deg, oklch(20% 0.03 260) 0%, oklch(15% 0.02 240) 100%)" },
  D: { background: "oklch(18% 0.035 50)" },
};

function StoryHeader({
  storyline,
  priceInfo,
  storylineId,
  coverUrl,
}: {
  storyline: Storyline;
  priceInfo: TokenPriceInfo | null;
  storylineId: number;
  coverUrl?: string;
}) {
  const createdDate = storyline.block_timestamp
    ? new Date(storyline.block_timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
  const variant = hashToVariant(storylineId);

  const statsGrid = priceInfo ? (
    <div className="grid grid-cols-3 gap-1.5">
      <div className="rounded-[var(--card-radius)] border border-border bg-surface px-3 py-2.5">
        <div className="text-[10px] font-medium uppercase tracking-[0.04em] text-muted mb-1">Market Cap</div>
        <div className="text-[15px] font-semibold tabular-nums text-accent">
          <MarketCapBox
            tokenAddress={storyline.token_address}
            totalSupply={parseFloat(priceInfo.totalSupply)}
            pricePerToken={parseFloat(priceInfo.pricePerToken)}
          />
        </div>
      </div>
      <div className="rounded-[var(--card-radius)] border border-border bg-surface px-3 py-2.5">
        <div className="text-[10px] font-medium uppercase tracking-[0.04em] text-muted mb-1">Price</div>
        <div className="text-[15px] font-semibold tabular-nums text-foreground">
          <TokenPriceBox pricePerToken={parseFloat(priceInfo.pricePerToken)} />
        </div>
      </div>
      <div className="rounded-[var(--card-radius)] border border-border bg-surface px-3 py-2.5">
        <div className="text-[10px] font-medium uppercase tracking-[0.04em] text-muted mb-1">Supply</div>
        <div className="text-[15px] font-semibold tabular-nums text-foreground">
          {formatSupply(priceInfo.totalSupply)}
        </div>
      </div>
      <div className="rounded-[var(--card-radius)] border border-border bg-surface px-3 py-2.5">
        <div className="text-[10px] font-medium uppercase tracking-[0.04em] text-muted mb-1">Plots</div>
        <div className="text-[15px] font-semibold tabular-nums text-foreground">{storyline.plot_count}</div>
      </div>
      <div className="rounded-[var(--card-radius)] border border-border bg-surface px-3 py-2.5">
        <div className="text-[10px] font-medium uppercase tracking-[0.04em] text-muted mb-1">Deadline</div>
        <div className="text-[15px] font-semibold tabular-nums text-foreground leading-tight">
          {storyline.sunset ? (
            "Complete"
          ) : storyline.has_deadline && storyline.last_plot_time ? (
            <DeadlineCountdown lastPlotTime={storyline.last_plot_time} hideLabel valueClassName="text-[15px] font-semibold tabular-nums text-foreground" />
          ) : !storyline.has_deadline ? (
            "Open"
          ) : (
            "—"
          )}
        </div>
      </div>
      <div className="rounded-[var(--card-radius)] border border-border bg-surface px-3 py-2.5">
        <div className="text-[10px] font-medium uppercase tracking-[0.04em] text-muted mb-1">Created</div>
        <div className="text-[15px] font-semibold tabular-nums text-foreground">{createdDate ?? "—"}</div>
      </div>
    </div>
  ) : null;

  const ctaButton = (
    <AddPlotButton storylineId={storyline.storyline_id} writerAddress={storyline.writer_address} lastPlotTime={storyline.last_plot_time} sunset={storyline.sunset} hasDeadline={storyline.has_deadline} />
  );

  return (
    <header className="pb-6 grid gap-x-6 grid-cols-1 sm:grid-cols-[200px_1fr] lg:grid-cols-[280px_1fr]">
      {/* Cover frame — stacks on mobile, side column on sm+ */}
      <div className="sm:row-span-2">
        <div
          className="relative mx-auto w-[220px] overflow-hidden rounded-md sm:mx-0 sm:w-full"
          style={{ aspectRatio: "2/3" }}
        >
          {coverUrl ? (
            <img src={coverUrl} alt={storyline.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center" style={FALLBACK_STYLES[variant]}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent mb-3">
                {storyline.genre || "Uncategorized"}
              </div>
              <h2 className="font-heading text-[22px] font-semibold leading-tight text-[oklch(85%_0.01_70)]">
                {storyline.title}
              </h2>
              <div className="mt-3.5 h-0.5 w-8 rounded-sm bg-accent" />
              <div className="mt-2.5 text-xs text-muted">
                <WriterIdentity address={storyline.writer_address} writerType={storyline.writer_type} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info column */}
      <div className="min-w-0 pt-1">
        {/* Badges row */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          <span className="rounded-[3px] border border-border bg-surface px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.03em] text-foreground/80">
            {storyline.genre || "Uncategorized"}
          </span>
          {storyline.writer_type === 1 && (
            <span className="rounded-[3px] border border-[oklch(55%_0.18_280_/_0.25)] bg-[oklch(55%_0.18_280_/_0.15)] px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.03em] text-[oklch(72%_0.12_280)]">
              AI Writer
            </span>
          )}
          {storyline.language && storyline.language !== "English" && (
            <span className="rounded-[3px] border border-border px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.03em] text-muted">
              {storyline.language}
            </span>
          )}
        </div>

        <h1 className="font-heading text-2xl sm:text-[32px] font-semibold leading-[1.15] tracking-tight text-foreground">
          {storyline.title}
        </h1>

        {/* Rating + views */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-muted">
          <RatingSummary storylineId={storyline.storyline_id} separator />
          <ViewCount storylineId={storyline.storyline_id} initialCount={storyline.view_count} />
        </div>

        {/* Writer row */}
        <div className="mt-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-[13px] font-semibold text-foreground/70">
            {storyline.writer_address.slice(2, 4).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Suspense fallback={<span>{truncateAddress(storyline.writer_address)}</span>}>
                <WriterIdentity address={storyline.writer_address} writerType={storyline.writer_type} />
              </Suspense>
              {storyline.writer_type === 1 && <AgentBadge />}
            </div>
            <div className="font-mono text-[11px] text-muted">{truncateAddress(storyline.writer_address)}</div>
          </div>
        </div>
      </div>

      {/* Stats + CTA */}
      <div className="col-span-1 sm:col-start-2">
        {statsGrid && <div className="mt-4 sm:mt-6">{statsGrid}</div>}
        <div className="[&_a]:w-full [&_div]:w-full sm:[&_a]:w-auto sm:[&_div]:w-auto">{ctaButton}</div>
      </div>
    </header>
  );
}

function GenesisSection({ plot, readingMode }: { plot: Plot; readingMode?: React.ReactNode }) {
  return (
    <section id="genesis">
      <ViewTracker storylineId={plot.storyline_id} plotIndex={0} />
      <div className="text-muted mb-3 flex items-center gap-3 text-xs">
        <span className="text-accent-dim font-medium">Genesis</span>
        {plot.block_timestamp && (
          <time dateTime={plot.block_timestamp}>
            {new Date(plot.block_timestamp).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </time>
        )}
        {readingMode && <span className="ml-auto">{readingMode}</span>}
      </div>
      {plot.content ? (
        <StoryContent content={plot.content} />
      ) : (
        <p className="text-muted text-sm italic">
          Content unavailable (CID: {plot.content_cid})
        </p>
      )}
    </section>
  );
}

function TableOfContents({
  storylineId,
  chapters,
}: {
  storylineId: number;
  chapters: Plot[];
}) {
  return (
    <section className="mt-10">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted pb-2.5 border-b border-border mb-5">
        Chapters
      </h2>
      <ul className="space-y-0">
        {chapters.map((ch) => {
          const chapterTitle = ch.title || `Chapter ${ch.plot_index}`;
          const preview = ch.content ? ch.content.slice(0, 100) : "";
          const dateStr = ch.block_timestamp
            ? new Date(ch.block_timestamp).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : null;

          return (
            <li key={ch.id}>
              <Link
                href={`/story/${storylineId}/${ch.plot_index}`}
                className="grid grid-cols-[48px_1fr_auto] items-baseline gap-3 border-b border-border/50 px-3 py-3.5 transition-colors hover:bg-surface/50 sm:grid-cols-[48px_1fr_auto]"
              >
                <span className="font-mono text-xs font-medium tabular-nums text-muted">
                  #{ch.plot_index}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{chapterTitle}</div>
                  {preview && (
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {preview}{ch.content && ch.content.length > 100 ? "…" : ""}
                    </p>
                  )}
                </div>
                <span className="font-mono text-[11px] tabular-nums text-muted/60 whitespace-nowrap">
                  {dateStr}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <div className="flex min-h-[calc(100vh-2.75rem)] flex-col items-center justify-center px-6">
      <p className="text-muted text-sm">{message}</p>
    </div>
  );
}
