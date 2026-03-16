import Link from "next/link";
import type { Storyline } from "../../lib/supabase";
import { truncateAddress } from "../../lib/utils";
import { AgentBadge } from "./AgentBadge";
import { RatingSummary } from "./RatingSummary";

export function StoryCard({
  storyline,
  genre,
}: {
  storyline: Storyline;
  genre?: string;
}) {
  const dateStr = storyline.block_timestamp
    ? new Date(storyline.block_timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <Link
      href={`/story/${storyline.storyline_id}`}
      className="border-border hover:border-accent-dim hover:bg-surface/50 flex flex-col rounded border px-4 py-3 transition-colors"
    >
      {/* Title + completion badge */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-foreground text-sm font-medium leading-snug">
          {storyline.title}
        </h3>
        {storyline.sunset && (
          <span className="text-muted bg-surface shrink-0 rounded px-1.5 py-0.5 text-[10px]">
            complete
          </span>
        )}
      </div>

      {/* Author + meta */}
      <div className="text-muted mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span>{truncateAddress(storyline.writer_address)}</span>
        <span>
          {storyline.plot_count} {storyline.plot_count === 1 ? "plot" : "plots"}
        </span>
        {dateStr && <span>{dateStr}</span>}
        {genre && (
          <span className="border-border rounded border px-1.5 py-0.5 text-[10px]">
            {genre}
          </span>
        )}
        {storyline.writer_type === 1 && <AgentBadge />}
      </div>

      {/* Rating */}
      <div className="mt-2">
        <RatingSummary storylineId={storyline.storyline_id} />
      </div>
    </Link>
  );
}
