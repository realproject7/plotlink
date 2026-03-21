import Link from "next/link";
import type { Storyline } from "../../lib/supabase";
import { AgentBadge } from "./AgentBadge";
import { WriterIdentityClient } from "./WriterIdentityClient";
import { RatingSummary } from "./RatingSummary";
import { StoryCardTVL } from "./StoryCardStats";

const DAY_MS = 24 * 60 * 60 * 1000;
function isWithin24h(timestamp: string): boolean {
  return Date.now() - new Date(timestamp).getTime() < DAY_MS;
}

export function StoryCard({
  storyline,
  genre,
}: {
  storyline: Storyline;
  genre?: string;
}) {
  const displayGenre = genre || storyline.genre;
  const isNew = storyline.last_plot_time
    ? isWithin24h(storyline.last_plot_time)
    : false;

  return (
    <div className="group flex flex-col" style={{ perspective: "800px" }}>
      {/* 3D Book with spine */}
      <Link
        href={`/story/${storyline.storyline_id}`}
        className="relative block transition-transform duration-300 ease-out [transform:rotateY(-3deg)] group-hover:[transform:rotateY(0deg)_translateY(-6px)]"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Drop shadow beneath book — grows on hover */}
        <div className="pointer-events-none absolute -bottom-2 left-2 right-2 h-4 rounded-sm bg-[var(--shelf-shadow)] blur-md transition-all duration-300 group-hover:-bottom-3 group-hover:left-1 group-hover:right-1 group-hover:blur-lg" />

        {/* Spine — dark cloth-bound band */}
        <div
          className="absolute inset-y-0 left-0 w-5 rounded-l-sm"
          style={{
            background: "linear-gradient(to right, #1A0F0A, #2C1810, #3A2A1A)",
            transform: "translateZ(-2px)",
          }}
        />

        {/* Page edges visible on right side */}
        <div
          className="pointer-events-none absolute inset-y-1 -right-[3px] w-[3px] rounded-r-[1px]"
          style={{
            background:
              "repeating-linear-gradient(to bottom, #F5EFE4 0px, #F5EFE4 1px, #E8DFD0 1px, #E8DFD0 2px)",
          }}
        />

        {/* Page edges visible on bottom */}
        <div
          className="pointer-events-none absolute -bottom-[3px] left-5 right-0 h-[3px] rounded-b-[1px]"
          style={{
            background:
              "repeating-linear-gradient(to right, #F5EFE4 0px, #F5EFE4 1px, #E8DFD0 1px, #E8DFD0 2px)",
          }}
        />

        {/* Front cover */}
        <div className="relative flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-sm rounded-l-none border border-[var(--border)] bg-gradient-to-br from-[#F7F0E5] via-[#F2E8D6] to-[#EBE0CE] transition-[border-color,box-shadow] duration-300 group-hover:border-[var(--accent-dim)] group-hover:shadow-lg">
          {/* Spine inner shadow overlay */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-8"
            style={{
              background:
                "linear-gradient(to right, rgba(26,15,10,0.18), transparent)",
            }}
          />

          {/* Content */}
          <div className="relative flex flex-1 flex-col justify-between py-5 pl-7 pr-4">
            {/* Top: genre badge + completion */}
            <div className="flex items-start justify-between gap-2">
              <span className="rounded-sm bg-[var(--accent)]/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-[var(--accent-dim)]">
                {displayGenre || "Uncategorized"}
              </span>
              {storyline.sunset && (
                <span className="rounded-sm border border-[var(--border)] px-1.5 py-0.5 text-[9px] text-[var(--text-muted)]">
                  complete
                </span>
              )}
            </div>

            {/* Center: title displayed like printed book cover */}
            <div className="flex flex-1 flex-col items-center justify-center px-1 text-center">
              <h3 className="font-heading text-base font-bold leading-tight tracking-tight text-[var(--accent-title)] sm:text-lg">
                {storyline.title}
              </h3>
              {storyline.language && storyline.language !== "English" && (
                <span className="mt-2 text-[10px] text-[var(--text-muted)]">
                  {storyline.language}
                </span>
              )}
            </div>

            {/* Bottom: author name like a printed book */}
            <div className="flex items-center justify-center gap-1 text-xs text-[var(--text-muted)]">
              <WriterIdentityClient address={storyline.writer_address} linkProfile={false} />
              {storyline.writer_type === 1 && <AgentBadge />}
            </div>
          </div>

          {/* Decorative horizontal rule near bottom */}
          <div className="mx-5 mb-4 h-px bg-[var(--border)]/60" />
        </div>
      </Link>

      {/* Metadata below book */}
      <div className="mt-2.5 flex flex-col gap-0.5 pl-1 pr-1 text-[10px] text-[var(--text-muted)]">
        {storyline.token_address && (
          <span className="whitespace-nowrap">
            <StoryCardTVL tokenAddress={storyline.token_address} />
          </span>
        )}
        <span className="whitespace-nowrap">
          {storyline.plot_count} {storyline.plot_count === 1 ? "plot" : "plots"} linked
          {isNew && <span className="ml-1 text-[10px] font-bold text-[var(--accent)]">NEW</span>}
        </span>
        <RatingSummary storylineId={storyline.storyline_id} />
      </div>
    </div>
  );
}
