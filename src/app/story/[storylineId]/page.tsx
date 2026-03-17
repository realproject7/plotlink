import { type Metadata } from "next";
import { Suspense } from "react";
import { createServerClient, type Storyline, type Plot } from "../../../../lib/supabase";
import { DeadlineCountdown } from "../../../components/DeadlineCountdown";
import { TradingWidget } from "../../../components/TradingWidget";
import { PriceChart } from "../../../components/PriceChart";
import { DonateWidget } from "../../../components/DonateWidget";
import { RatingWidget } from "../../../components/RatingWidget";
import { RatingSummary } from "../../../components/RatingSummary";
import { ShareToFarcaster } from "../../../components/ShareToFarcaster";
import { getTokenPrice, type TokenPriceInfo } from "../../../../lib/price";
import { RESERVE_LABEL, STORY_FACTORY } from "../../../../lib/contracts/constants";
import { type Address } from "viem";
import { truncateAddress } from "../../../../lib/utils";
import Link from "next/link";
import { AgentBadge } from "../../../components/AgentBadge";
import { WriterIdentity } from "../../../components/WriterIdentity";
import { ViewCount, ViewTracker } from "../../../components/ViewCount";
import { CommentSection } from "../../../components/CommentSection";

type Params = Promise<{ storylineId: string }>;

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Generate a cover gradient from storyline ID (same logic as StoryCard).
 */
function generateCoverGradient(id: number): string {
  const h1 = (id * 137) % 360;
  const h2 = (id * 251 + 97) % 360;
  const h3 = (id * 83 + 199) % 360;
  const angle = (id * 53) % 180;
  const x = (id * 31) % 80 + 10;
  const y = (id * 67) % 80 + 10;

  return `
    radial-gradient(ellipse at ${x}% ${y}%, hsla(${h1}, 60%, 20%, 0.7) 0%, transparent 60%),
    radial-gradient(ellipse at ${100 - x}% ${100 - y}%, hsla(${h2}, 50%, 15%, 0.5) 0%, transparent 50%),
    linear-gradient(${angle}deg, hsla(${h3}, 40%, 8%, 1) 0%, hsla(${h1}, 30%, 5%, 1) 100%)
  `;
}

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
    ? ` — Price: ${priceInfo.pricePerToken} ${reserveLabel}`
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
        splashBackgroundColor: "#0a0a0a",
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
    <div className="animate-in mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <ViewTracker storylineId={id} />

      {/* Cover header with generative background */}
      <StoryHeader storyline={sl} priceInfo={priceInfo} />

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        {/* Story content — immersive reading area */}
        <main>
          {genesis ? (
            <>
              <GenesisSection plot={genesis} />
              <CommentSection storylineId={id} plotIndex={0} />
            </>
          ) : (
            <p className="text-muted text-sm">No plots yet.</p>
          )}

          {chapters.length > 0 && (
            <TableOfContents storylineId={id} chapters={chapters} />
          )}
        </main>

        {/* Sidebar — engagement widgets */}
        <aside className="order-first space-y-4 lg:order-none">
          {sl.token_address && priceInfo && (
            <PriceChart
              tokenAddress={sl.token_address as Address}
              totalSupplyRaw={priceInfo.totalSupplyRaw}
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
          <ShareToFarcaster storylineId={id} title={sl.title} />
        </aside>
      </div>
    </div>
  );
}

function StoryHeader({
  storyline,
  priceInfo,
}: {
  storyline: Storyline;
  priceInfo: TokenPriceInfo | null;
}) {
  const reserveLabel = RESERVE_LABEL;
  const coverGradient = generateCoverGradient(storyline.storyline_id);

  return (
    <header className="relative overflow-hidden rounded-lg border border-border-subtle">
      {/* Generative cover background */}
      <div
        className="px-6 pb-6 pt-10 sm:px-8 sm:pt-14"
        style={{ background: coverGradient }}
      >
        {/* Genre + status badges */}
        <div className="mb-4 flex flex-wrap gap-2">
          {storyline.genre && (
            <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] text-muted backdrop-blur-sm">
              {storyline.genre}
            </span>
          )}
          {storyline.language && storyline.language !== "English" && (
            <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] text-muted backdrop-blur-sm">
              {storyline.language}
            </span>
          )}
          {storyline.sunset && (
            <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] text-accent-dim backdrop-blur-sm">
              complete
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {storyline.title}
        </h1>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>
            by{" "}
            <Suspense
              fallback={
                <span className="text-foreground">
                  {truncateAddress(storyline.writer_address)}
                </span>
              }
            >
              <WriterIdentity address={storyline.writer_address} />
            </Suspense>
          </span>
          <span>
            {storyline.plot_count}{" "}
            {storyline.plot_count === 1 ? "plot" : "plots"}
          </span>
          <ViewCount
            storylineId={storyline.storyline_id}
            initialCount={storyline.view_count}
          />
          {storyline.writer_type === 1 && <AgentBadge />}
          <RatingSummary storylineId={storyline.storyline_id} />
        </div>
      </div>

      {/* Price info bar */}
      {priceInfo && (
        <div className="grid grid-cols-2 gap-2 border-t border-border-subtle bg-surface px-6 py-3 text-xs sm:px-8">
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-muted">
              Token Price
            </span>
            <span className="text-foreground">
              {priceInfo.pricePerToken} {reserveLabel}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-muted">
              Supply Minted
            </span>
            <span className="text-foreground">
              {priceInfo.totalSupply} tokens
            </span>
          </div>
        </div>
      )}

      {/* Deadline / completion */}
      {storyline.sunset ? (
        <div className="border-t border-border-subtle bg-surface px-6 py-2 text-xs sm:px-8">
          <span className="text-muted">Story complete</span>
          <span className="ml-2 text-foreground">
            {storyline.plot_count}{" "}
            {storyline.plot_count === 1 ? "plot" : "plots"} total
          </span>
        </div>
      ) : storyline.last_plot_time ? (
        <div className="border-t border-border-subtle px-6 sm:px-8">
          <DeadlineCountdown lastPlotTime={storyline.last_plot_time} />
        </div>
      ) : null}
    </header>
  );
}

function GenesisSection({ plot }: { plot: Plot }) {
  return (
    <section>
      <ViewTracker storylineId={plot.storyline_id} plotIndex={0} />
      <div className="mb-4 flex items-baseline gap-3 text-xs text-muted">
        <span className="font-medium text-accent-dim">Genesis</span>
        {plot.block_timestamp && (
          <time dateTime={plot.block_timestamp}>
            {new Date(plot.block_timestamp).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </time>
        )}
      </div>
      {plot.content ? (
        <div className="reading-area whitespace-pre-wrap">{plot.content}</div>
      ) : (
        <p className="text-sm italic text-muted">
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
    <section className="mt-12">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
        Chapters
      </h2>
      <div className="divide-y divide-border-subtle">
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
            <Link
              key={ch.id}
              href={`/story/${storylineId}/${ch.plot_index}`}
              className="book-spine group flex items-start justify-between gap-4 py-3.5 pl-4 transition-colors hover:bg-surface/50"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                  {chapterTitle}
                </div>
                {preview && (
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {preview}
                    {ch.content && ch.content.length > 100 ? "..." : ""}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-xs text-muted">{dateStr}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <div className="flex min-h-[calc(100vh-2.75rem)] flex-col items-center justify-center px-6">
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}
