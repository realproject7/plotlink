import Link from "next/link";
import type { Storyline } from "../../lib/supabase";
import { WriterIdentityClient } from "./WriterIdentityClient";
import { StoryCardTVL } from "./StoryCardStats";
import { getStoryStatus } from "../../lib/story-status";
import { getCoverUrl } from "../../lib/cover";

export type FallbackVariant = "A" | "B" | "C" | "D";

export function hashToVariant(id: number): FallbackVariant {
  const variants: FallbackVariant[] = ["A", "B", "C", "D"];
  return variants[((id * 2654435761) >>> 0) % 4];
}

export const FALLBACK_STYLES: Record<FallbackVariant, React.CSSProperties> = {
  A: { background: "radial-gradient(circle at 30% 70%, oklch(88% 0.03 28 / 0.4) 0%, transparent 60%), linear-gradient(160deg, oklch(93% 0.015 50) 0%, oklch(90% 0.012 30) 100%)" },
  B: { background: "radial-gradient(circle at 50% 40%, oklch(90% 0.025 160 / 0.35) 0%, transparent 55%), linear-gradient(170deg, oklch(93% 0.015 140) 0%, oklch(89% 0.012 170) 100%)" },
  C: { background: "radial-gradient(circle at 70% 30%, oklch(90% 0.02 280 / 0.3) 0%, transparent 50%), linear-gradient(180deg, oklch(94% 0.012 260) 0%, oklch(91% 0.01 240) 100%)" },
  D: { background: "linear-gradient(175deg, oklch(94% 0.015 50) 0%, oklch(90% 0.02 40) 100%)" },
};

function Badges({ genre, writerType, status, isNsfw, contentType }: { genre?: string | null; writerType: number | null; status: string; isNsfw?: boolean; contentType?: string }) {
  const isActive = status === "active";
  return (
    <div className="absolute top-2 left-2 z-[2] flex flex-wrap items-center gap-1">
      {genre && (
        <span className="rounded-[3px] bg-[oklch(0%_0_0_/_0.45)] px-[7px] py-[2px] text-[10px] font-medium uppercase tracking-wider leading-[1.4] text-white/90 backdrop-blur-[2px]">
          {genre}
        </span>
      )}
      {writerType === 1 && (
        <span className="rounded-[3px] bg-[oklch(45%_0.15_280_/_0.6)] px-[7px] py-[2px] text-[10px] font-medium uppercase tracking-wider leading-[1.4] text-white/90 backdrop-blur-[2px]">
          AI Writer
        </span>
      )}
      {status === "completed" && (
        <span className="rounded-[3px] bg-[oklch(40%_0.10_145_/_0.6)] px-[7px] py-[2px] text-[10px] font-medium uppercase tracking-wider leading-[1.4] text-white/90 backdrop-blur-[2px]">
          Complete
        </span>
      )}
      {isActive && (
        <span className="rounded-[3px] bg-[oklch(40%_0.10_145_/_0.6)] px-[7px] py-[2px] text-[10px] font-medium uppercase tracking-wider leading-[1.4] text-white/90 backdrop-blur-[2px]">
          Ongoing
        </span>
      )}
      {contentType === "cartoon" && (
        <span className="rounded-[3px] bg-[oklch(50%_0.15_60_/_0.65)] px-[7px] py-[2px] text-[10px] font-medium uppercase tracking-wider leading-[1.4] text-white/90 backdrop-blur-[2px]">
          Cartoon
        </span>
      )}
      {isNsfw && (
        <span className="rounded-[3px] bg-[oklch(45%_0.18_25_/_0.7)] px-[7px] py-[2px] text-[10px] font-medium uppercase tracking-wider leading-[1.4] text-white/90 backdrop-blur-[2px]">
          18+
        </span>
      )}
    </div>
  );
}

const cardClass = "group relative block aspect-[2/3] overflow-hidden rounded-[var(--card-radius)] border border-[var(--border)] shadow-[0_1px_3px_oklch(0%_0_0_/_0.06)] transition-[transform,box-shadow] duration-200 ease-out hover:z-[2] hover:scale-[1.03] hover:shadow-[0_12px_40px_oklch(0%_0_0_/_0.12)]";

export function StoryCard({
  storyline,
  genre,
}: {
  storyline: Storyline;
  genre?: string;
}) {
  const displayGenre = genre || storyline.genre;
  const status = getStoryStatus(storyline);
  const variant = hashToVariant(storyline.storyline_id);
  const coverUrl = getCoverUrl(storyline.cover_cid);

  if (coverUrl) {
    return (
      <Link href={`/story/${storyline.storyline_id}`} className={cardClass}>
        <img
          src={coverUrl}
          alt={storyline.title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_40%,oklch(0%_0_0_/_0.15)_60%,oklch(0%_0_0_/_0.55)_80%,oklch(0%_0_0_/_0.78)_100%)]" />

        <Badges genre={displayGenre} writerType={storyline.writer_type} status={status} isNsfw={storyline.is_nsfw} contentType={storyline.content_type} />

        <div className="absolute right-0 bottom-0 left-0 z-[2] px-2.5 pt-3 pb-2.5">
          <h3 className="font-heading text-[13px] font-semibold leading-[1.25] text-white drop-shadow-[0_1px_2px_oklch(0%_0_0_/_0.6)] line-clamp-2 sm:text-[15px]">
            {storyline.title}
          </h3>
          <div className="mt-[3px] text-[11px] text-white/75 drop-shadow-[0_1px_1px_oklch(0%_0_0_/_0.5)]">
            <WriterIdentityClient address={storyline.writer_address} writerType={storyline.writer_type} />
          </div>
          {storyline.token_address && (
            <div className="mt-1.5">
              <span className="font-mono text-[10px] tabular-nums text-white/70 drop-shadow-[0_1px_1px_oklch(0%_0_0_/_0.5)]">
                <StoryCardTVL tokenAddress={storyline.token_address} />
              </span>
            </div>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/story/${storyline.storyline_id}`} className={cardClass}>
      <div className="absolute inset-0" style={FALLBACK_STYLES[variant]} />

      <Badges genre={displayGenre} writerType={storyline.writer_type} status={status} isNsfw={storyline.is_nsfw} contentType={storyline.content_type} />

      {/* Centered title with accent line */}
      <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center px-4 text-center">
        <h3 className="font-heading text-base font-semibold leading-tight text-[var(--fg)] line-clamp-3 sm:text-lg" style={{ maxWidth: "90%" }}>
          {storyline.title}
        </h3>
        <div className="mt-2.5 h-0.5 w-8 rounded-sm bg-[var(--accent)]" />
      </div>

      {/* Bottom author + TVL */}
      <div className="absolute right-0 bottom-0 left-0 z-[2] px-2.5 pb-2.5">
        <div className="text-[11px] text-[var(--muted)]">
          <WriterIdentityClient address={storyline.writer_address} writerType={storyline.writer_type} />
        </div>
        {storyline.token_address && (
          <div className="mt-1">
            <span className="font-mono text-[10px] tabular-nums text-[var(--muted)] [&_.font-semibold]:text-[var(--fg)]">
              <StoryCardTVL tokenAddress={storyline.token_address} />
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
