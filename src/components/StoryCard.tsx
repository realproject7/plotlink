import Link from "next/link";
import type { Storyline } from "../../lib/supabase";
import { AgentBadge } from "./AgentBadge";
import { WriterIdentityClient } from "./WriterIdentityClient";
import { RatingSummary } from "./RatingSummary";
import { StoryCardTVL, StoryCardPrice } from "./StoryCardStats";
import { getStoryStatus } from "../../lib/story-status";

const DAY_MS = 24 * 60 * 60 * 1000;
function isWithin24h(timestamp: string): boolean {
  return Date.now() - new Date(timestamp).getTime() < DAY_MS;
}

type FallbackVariant = "A" | "B" | "C" | "D";

function hashToVariant(id: number): FallbackVariant {
  const variants: FallbackVariant[] = ["A", "B", "C", "D"];
  return variants[((id * 2654435761) >>> 0) % 4];
}

const FALLBACK_STYLES: Record<FallbackVariant, React.CSSProperties> = {
  A: { background: "radial-gradient(ellipse at 30% 20%, oklch(28% 0.04 40), oklch(16% 0.02 50))" },
  B: { background: "repeating-linear-gradient(135deg, oklch(18% 0.018 50) 0px, oklch(18% 0.018 50) 8px, oklch(22% 0.02 45) 8px, oklch(22% 0.02 45) 16px)" },
  C: { background: "conic-gradient(from 180deg at 50% 50%, oklch(20% 0.03 220), oklch(18% 0.02 50), oklch(20% 0.03 220))" },
  D: { background: "oklch(20% 0.025 50)" },
};

export function StoryCard({
  storyline,
  genre,
  coverUrl,
}: {
  storyline: Storyline;
  genre?: string;
  coverUrl?: string;
}) {
  const displayGenre = genre || storyline.genre;
  const isNew = storyline.last_plot_time
    ? isWithin24h(storyline.last_plot_time)
    : false;
  const status = getStoryStatus(storyline);
  const isActive = status === "active";
  const variant = hashToVariant(storyline.storyline_id);

  return (
    <Link
      href={`/story/${storyline.storyline_id}`}
      className="group relative block aspect-[2/3] overflow-hidden rounded-[var(--card-radius)] transition-transform duration-200 ease-out hover:scale-[1.03] hover:shadow-lg"
    >
      {/* Cover image or fallback pattern */}
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={storyline.title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0" style={FALLBACK_STYLES[variant]}>
          {/* Fallback: centered title treatment */}
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="mb-3 h-px w-8 bg-[var(--accent)]/40" />
            <h3 className="font-heading text-base font-medium leading-tight tracking-tight text-white sm:text-lg">
              {storyline.title}
            </h3>
            <div className="mt-2 text-[10px] text-white/70">
              <WriterIdentityClient address={storyline.writer_address} writerType={storyline.writer_type} />
            </div>
            <div className="mt-3 h-px w-8 bg-[var(--accent)]/40" />
          </div>
        </div>
      )}

      {/* Gradient overlay — always present */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Top-left badges */}
      <div className="absolute top-0 left-0 z-10 flex flex-wrap gap-1 p-2">
        <span className="rounded-sm bg-black/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
          {displayGenre || "Uncategorized"}
        </span>
        {storyline.writer_type === 1 && (
          <span className="rounded-sm bg-black/50 px-1.5 py-0.5 backdrop-blur-sm">
            <AgentBadge />
          </span>
        )}
        {isActive && (
          <span className="rounded-sm bg-[var(--accent)]/80 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
            Active
          </span>
        )}
        {isNew && (
          <span className="rounded-sm bg-[var(--accent)]/80 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
            NEW
          </span>
        )}
        {storyline.language && storyline.language !== "English" && (
          <span className="rounded-sm bg-black/50 px-1.5 py-0.5 text-[9px] text-white/80 backdrop-blur-sm">
            {storyline.language}
          </span>
        )}
      </div>

      {/* Bottom card info */}
      <div className="absolute right-0 bottom-0 left-0 z-10 p-3">
        {coverUrl && (
          <h3 className="font-heading text-sm font-medium leading-snug tracking-tight text-white sm:text-base">
            {storyline.title}
          </h3>
        )}
        <div className="mt-1 flex items-center gap-1 text-[10px] text-white/70">
          <WriterIdentityClient address={storyline.writer_address} writerType={storyline.writer_type} />
        </div>
        {storyline.token_address && (
          <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] font-mono text-white/60">
            <span><StoryCardPrice tokenAddress={storyline.token_address} /></span>
            <span><StoryCardTVL tokenAddress={storyline.token_address} /></span>
          </div>
        )}
        <div className="mt-1 text-[10px] text-white/50">
          {storyline.plot_count} {storyline.plot_count === 1 ? "plot" : "plots"}
          <span className="ml-1.5">
            <RatingSummary storylineId={storyline.storyline_id} />
          </span>
        </div>
      </div>
    </Link>
  );
}
