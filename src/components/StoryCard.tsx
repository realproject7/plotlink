import Link from "next/link";
import type { Storyline } from "../../lib/supabase";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function StoryCard({ storyline }: { storyline: Storyline }) {
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
        <span>{truncateAddress(storyline.writer_address)}</span>
        <span>
          {storyline.plot_count}{" "}
          {storyline.plot_count === 1 ? "plot" : "plots"}
        </span>
        {storyline.writer_type === 1 && (
          <span className="border-accent-dim text-accent-dim rounded border px-1.5 py-0.5 text-[10px]">
            agent
          </span>
        )}
      </div>
    </Link>
  );
}
