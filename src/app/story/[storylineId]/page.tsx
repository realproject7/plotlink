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
import { RESERVE_LABEL } from "../../../../lib/contracts/constants";
import { type Address } from "viem";
import { truncateAddress } from "../../../../lib/utils";
import { AgentBadge } from "../../../components/AgentBadge";
import { WriterIdentity } from "../../../components/WriterIdentity";

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
  const description = `A collaborative on-chain story by ${truncateAddress(sl.writer_address)} — ${sl.plot_count} ${sl.plot_count === 1 ? "plot" : "plots"}${priceSuffix}`;

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
    .single();

  if (!storyline) {
    return <NotFound message="Storyline not found" />;
  }

  const { data: plotRows } = await supabase
    .from("plots")
    .select("*")
    .eq("storyline_id", id)
    .eq("hidden", false)
    .order("plot_index", { ascending: true })
    .returns<Plot[]>();

  const plots = plotRows ?? [];

  const sl = storyline as Storyline;
  const priceInfo = sl.token_address
    ? await getTokenPrice(sl.token_address as Address)
    : null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <StoryHeader storyline={storyline} priceInfo={priceInfo} />

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        {/* Story content — primary reading area */}
        <main>
          {plots.length > 0 ? (
            <div className="space-y-10">
              {plots.map((plot) => (
                <PlotEntry key={plot.id} plot={plot} />
              ))}
            </div>
          ) : (
            <p className="text-muted text-sm">No plots yet.</p>
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
          <DonateWidget storylineId={id} />
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
              {priceInfo.pricePerToken} {reserveLabel}
            </span>
          </div>
          <div>
            <span className="text-muted block text-[10px] uppercase tracking-wider">
              Supply Minted
            </span>
            <span className="text-foreground">
              {priceInfo.totalSupply} tokens
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
      ) : storyline.has_deadline && storyline.last_plot_time ? (
        <DeadlineCountdown lastPlotTime={storyline.last_plot_time} />
      ) : null}
    </header>
  );
}

function PlotEntry({ plot }: { plot: Plot }) {
  return (
    <article className="border-border border-b pb-8 last:border-b-0">
      <div className="text-muted mb-3 flex items-baseline gap-3 text-xs">
        <span className="text-accent-dim font-medium">
          {plot.plot_index === 0 ? "Genesis" : `Plot #${plot.plot_index}`}
        </span>
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
    </article>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <div className="flex min-h-[calc(100vh-2.75rem)] flex-col items-center justify-center px-6">
      <p className="text-muted text-sm">{message}</p>
    </div>
  );
}
