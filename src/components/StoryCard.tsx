import Link from "next/link";
import type { Storyline } from "../../lib/supabase";
import { AgentBadge } from "./AgentBadge";
import { WriterIdentityClient } from "./WriterIdentityClient";
import { RatingSummary } from "./RatingSummary";
import { StoryCardStats } from "./StoryCardStats";
import { ViewCount } from "./ViewCount";

/**
 * Generate a unique gradient background from a storyline_id.
 * Uses simple hashing to produce deterministic, visually distinct covers.
 */
function generateCoverStyle(id: number): React.CSSProperties {
  const h1 = ((id * 137) % 360);
  const h2 = ((id * 251 + 97) % 360);
  const h3 = ((id * 83 + 199) % 360);
  const angle = ((id * 53) % 180);
  const x = ((id * 31) % 80) + 10;
  const y = ((id * 67) % 80) + 10;

  return {
    background: `
      radial-gradient(ellipse at ${x}% ${y}%, hsla(${h1}, 60%, 20%, 0.7) 0%, transparent 60%),
      radial-gradient(ellipse at ${100 - x}% ${100 - y}%, hsla(${h2}, 50%, 15%, 0.5) 0%, transparent 50%),
      linear-gradient(${angle}deg, hsla(${h3}, 40%, 8%, 1) 0%, hsla(${h1}, 30%, 5%, 1) 100%)
    `,
  };
}

export function StoryCard({
  storyline,
  genre,
  preview,
  featured = false,
}: {
  storyline: Storyline;
  genre?: string;
  preview?: string;
  featured?: boolean;
}) {
  const dateStr = storyline.block_timestamp
    ? new Date(storyline.block_timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  const coverStyle = generateCoverStyle(storyline.storyline_id);
  const displayGenre = genre || storyline.genre;

  return (
    <Link
      href={`/story/${storyline.storyline_id}`}
      className={`book-card book-spine group border border-border-subtle ${
        featured ? "glow-border" : ""
      }`}
      style={{
        ...coverStyle,
        aspectRatio: featured ? "3 / 4" : "3 / 4",
        minHeight: featured ? "320px" : "260px",
      }}
    >
      {/* Top accent — genre tag + completion badge */}
      <div className="flex items-start justify-between p-3 pb-0">
        <div className="flex flex-wrap gap-1.5">
          {displayGenre && (
            <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-muted backdrop-blur-sm">
              {displayGenre}
            </span>
          )}
          {storyline.language && storyline.language !== "English" && (
            <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-muted backdrop-blur-sm">
              {storyline.language}
            </span>
          )}
        </div>
        {storyline.sunset && (
          <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-accent-dim backdrop-blur-sm">
            complete
          </span>
        )}
      </div>

      {/* Spacer to push content down */}
      <div className="flex-1" />

      {/* Content area — gradient overlay for readability */}
      <div className="bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 pb-4 pt-10">
        {/* Title — typography hero */}
        <h3
          className={`font-bold leading-tight tracking-tight text-foreground ${
            featured ? "text-xl" : "text-base"
          }`}
        >
          {storyline.title}
        </h3>

        {/* Author */}
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
          <span className="inline-flex items-center gap-0.5">
            <WriterIdentityClient
              address={storyline.writer_address}
              linkProfile={false}
            />
          </span>
          {storyline.writer_type === 1 && <AgentBadge />}
        </div>

        {/* Preview text — styled like an opening line */}
        {preview && (
          <p className="mt-2 line-clamp-2 text-[11px] italic leading-relaxed text-muted/80">
            &ldquo;{preview}&rdquo;
          </p>
        )}

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
          <span>
            {storyline.plot_count}{" "}
            {storyline.plot_count === 1 ? "plot" : "plots"}
          </span>
          <ViewCount
            storylineId={storyline.storyline_id}
            initialCount={storyline.view_count}
          />
          {dateStr && <span>{dateStr}</span>}
        </div>

        {/* On-chain stats — subtle integration */}
        {storyline.token_address && (
          <div className="mt-2 rounded bg-black/30 px-2 py-1 backdrop-blur-sm">
            <StoryCardStats tokenAddress={storyline.token_address} />
          </div>
        )}

        {/* Rating */}
        <div className="mt-2">
          <RatingSummary storylineId={storyline.storyline_id} />
        </div>
      </div>
    </Link>
  );
}
