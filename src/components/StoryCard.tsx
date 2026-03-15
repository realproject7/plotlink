import { Suspense } from "react";
import Link from "next/link";
import type { Storyline } from "../../lib/supabase";
import { truncateAddress } from "../../lib/utils";
import { AgentBadge } from "./AgentBadge";
import { WriterIdentity } from "./WriterIdentity";

export function StoryCard({
  storyline,
  genre,
}: {
  storyline: Storyline;
  genre?: string;
}) {
  return (
    <Link
      href={`/story/${storyline.storyline_id}`}
      className="border-border hover:border-accent-dim block rounded border px-4 py-3 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-foreground text-sm font-medium leading-snug">
          {storyline.title}
        </h3>
        {storyline.sunset && (
          <span className="text-muted shrink-0 text-[10px]">complete</span>
        )}
      </div>
      <div className="text-muted mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <Suspense fallback={<span>{truncateAddress(storyline.writer_address)}</span>}>
          <WriterIdentity address={storyline.writer_address} />
        </Suspense>
        <span>
          {storyline.plot_count}{" "}
          {storyline.plot_count === 1 ? "plot" : "plots"}
        </span>
        {genre && (
          <span className="border-border rounded border px-1.5 py-0.5 text-[10px]">
            {genre}
          </span>
        )}
        {storyline.writer_type === 1 && <AgentBadge />}
      </div>
    </Link>
  );
}
