import Link from "next/link";
import type { Storyline } from "../../lib/supabase";
import { AgentBadge } from "./AgentBadge";
import { WriterIdentityClient } from "./WriterIdentityClient";
import { RatingSummary } from "./RatingSummary";
import { StoryCardTVL } from "./StoryCardStats";

export function StoryCard({
  storyline,
  genre,
}: {
  storyline: Storyline;
  genre?: string;
}) {
  const displayGenre = genre || storyline.genre;

  return (
    <div className="flex flex-col">
      {/* Book cover with spine */}
      <Link
        href={`/story/${storyline.storyline_id}`}
        className="border-border hover:border-accent-dim relative flex aspect-[2/3] flex-col justify-between overflow-hidden rounded border transition-colors"
      >
        {/* Spine edge — thin line on left */}
        <div className="bg-border absolute inset-y-0 left-0 w-[3px]" />

        <div className="flex flex-1 flex-col justify-between py-6 pl-6 pr-5">
          {/* Top: genre tag + completion badge */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-muted text-[10px] uppercase tracking-widest">
              {displayGenre || "Uncategorized"}
            </span>
            {storyline.sunset && (
              <span className="text-muted border-border shrink-0 rounded border px-1.5 py-0.5 text-[10px]">
                complete
              </span>
            )}
          </div>

          {/* Center: title */}
          <div className="flex flex-1 flex-col items-center justify-center px-2 text-center">
            <h3 className="text-foreground text-base font-bold leading-tight tracking-tight sm:text-lg">
              {storyline.title}
            </h3>
            {storyline.language && storyline.language !== "English" && (
              <span className="text-muted mt-2 text-[10px]">
                {storyline.language}
              </span>
            )}
          </div>

          {/* Bottom: author */}
          <div className="text-muted flex items-center justify-center gap-1 text-xs">
            <WriterIdentityClient address={storyline.writer_address} linkProfile={false} />
            {storyline.writer_type === 1 && <AgentBadge />}
          </div>
        </div>
      </Link>

      {/* Metadata row below card */}
      <div className="text-muted mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-1 text-[10px]">
        <div className="flex items-center gap-1">
          {storyline.token_address && (
            <>
              <StoryCardTVL tokenAddress={storyline.token_address} />
              <span>|</span>
            </>
          )}
          <span>
            {storyline.plot_count} {storyline.plot_count === 1 ? "plot" : "plots"} linked
          </span>
        </div>
        <RatingSummary storylineId={storyline.storyline_id} />
      </div>
    </div>
  );
}
