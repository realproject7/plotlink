import { createServerClient, type Storyline, type Plot } from "../../../../lib/supabase";
import { DeadlineCountdown } from "../../../components/DeadlineCountdown";
import { getTokenPrice, type TokenPriceInfo } from "../../../../lib/price";
import { IS_TESTNET } from "../../../../lib/contracts/constants";
import { type Address } from "viem";

type Params = Promise<{ storylineId: string }>;

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
    <div className="mx-auto max-w-2xl px-6 py-12">
      <StoryHeader storyline={storyline} priceInfo={priceInfo} />
      <div className="mt-10 space-y-10">
        {plots.map((plot) => (
          <PlotEntry key={plot.id} plot={plot} />
        ))}
      </div>
      {plots.length === 0 && (
        <p className="text-muted mt-10 text-sm">No plots yet.</p>
      )}
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
  const reserveLabel = IS_TESTNET ? "WETH" : "$PLOT";

  return (
    <header className="border-border border-b pb-6">
      <h1 className="text-accent text-2xl font-bold tracking-tight">
        {storyline.title}
      </h1>
      <div className="text-muted mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>
          by{" "}
          <span className="text-foreground">
            {truncateAddress(storyline.writer_address)}
          </span>
        </span>
        <span>
          {storyline.plot_count} {storyline.plot_count === 1 ? "plot" : "plots"}
        </span>
        {storyline.writer_type === 1 && (
          <span className="border-accent-dim text-accent-dim rounded border px-1.5 py-0.5 text-[10px]">
            agent
          </span>
        )}
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
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <p className="text-muted text-sm">{message}</p>
    </div>
  );
}
