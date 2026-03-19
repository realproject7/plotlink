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
import { ShareToFarcaster } from "../../../components/ShareToFarcaster";
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
    <div className="mx-auto max-w-5xl px-6 py-10 pb-24 lg:pb-10">
      <ViewTracker storylineId={id} />
      <StoryHeader storyline={storyline} priceInfo={priceInfo} />

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        {/* Story content — genesis + table of contents */}
        <main>
          {genesis ? (
            <>
              <GenesisSection plot={genesis} />
              <a
                href={chapters.length > 0 ? `/story/${id}/1` : "#genesis"}
                className="border-accent text-accent hover:bg-accent/10 mt-8 block w-full rounded border py-3 text-center text-sm font-medium transition-colors"
              >
                Read the first Plot
              </a>
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

          {/* Share — visible on mobile (sidebar hidden) */}
          <div className="mt-6 lg:hidden">
            <ShareToFarcaster storylineId={id} title={sl.title} />
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
          <ShareToFarcaster storylineId={id} title={sl.title} />
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

function StoryHeader({
  storyline,
  priceInfo,
}: {
  storyline: Storyline;
  priceInfo: TokenPriceInfo | null;
}) {
  const reserveLabel = RESERVE_LABEL;

  return (
    <header className="border-border border-b pb-6">
      <h1 className="text-accent text-2xl font-bold tracking-tight">
        {storyline.title}
      </h1>
      <div className="text-muted mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>
          by{" "}
          <Suspense fallback={<span className="text-foreground">{truncateAddress(storyline.writer_address)}</span>}>
            <WriterIdentity address={storyline.writer_address} />
          </Suspense>
        </span>
        <span>
          {storyline.plot_count} {storyline.plot_count === 1 ? "plot" : "plots"}
        </span>
        <ViewCount storylineId={storyline.storyline_id} initialCount={storyline.view_count} />
        {storyline.genre && (
          <span className="border-border rounded border px-1.5 py-0.5 text-[10px]">
            {storyline.genre}
          </span>
        )}
        {storyline.language && storyline.language !== "English" && (
          <span className="border-border rounded border px-1.5 py-0.5 text-[10px]">
            {storyline.language}
          </span>
        )}
        {storyline.writer_type === 1 && <AgentBadge />}
        <RatingSummary storylineId={storyline.storyline_id} />
      </div>

      {priceInfo && (
        <div className="border-border bg-surface mt-4 grid grid-cols-2 gap-2 rounded border px-3 py-2 text-xs">
          <div>
            <span className="text-muted block text-[10px] uppercase tracking-wider">
              Token Price
            </span>
            <span className="text-foreground">
              {formatPrice(priceInfo.pricePerToken)} {reserveLabel}
            </span>
          </div>
          <div>
            <span className="text-muted block text-[10px] uppercase tracking-wider">
              Supply Minted
            </span>
            <span className="text-foreground">
              {formatSupply(priceInfo.totalSupply)} tokens
            </span>
          </div>
        </div>
      )}
      {storyline.sunset ? (
        <div className="border-border bg-surface mt-4 rounded border px-3 py-2 text-xs">
          <span className="text-muted">Story complete</span>
          <span className="text-foreground ml-2">
            {storyline.plot_count} {storyline.plot_count === 1 ? "plot" : "plots"} total
          </span>
        </div>
      ) : storyline.last_plot_time ? (
        <DeadlineCountdown lastPlotTime={storyline.last_plot_time} />
      ) : null}
      {!storyline.sunset && (
        <AddPlotButton storylineId={storyline.storyline_id} writerAddress={storyline.writer_address} />
      )}
    </header>
  );
}

function GenesisSection({ plot }: { plot: Plot }) {
  return (
    <section id="genesis">
      <ViewTracker storylineId={plot.storyline_id} plotIndex={0} />
      <div className="text-muted mb-3 flex items-baseline gap-3 text-xs">
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
      </div>
      {plot.content ? (
        <div className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
          {plot.content}
        </div>
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
      <h2 className="text-foreground mb-4 text-sm font-semibold uppercase tracking-wider">
        Chapters
      </h2>
      <div className="divide-border divide-y">
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
              className="hover:bg-surface/50 flex items-start justify-between gap-4 py-3 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="text-foreground text-sm font-medium">
                  {chapterTitle}
                </div>
                {preview && (
                  <p className="text-muted mt-0.5 truncate text-xs">
                    {preview}
                    {ch.content && ch.content.length > 100 ? "…" : ""}
                  </p>
                )}
              </div>
              <div className="text-muted shrink-0 text-xs">
                {dateStr}
              </div>
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
      <p className="text-muted text-sm">{message}</p>
    </div>
  );
}
