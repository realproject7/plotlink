import Link from "next/link";
import type { Storyline } from "../../lib/supabase";
import { WriterIdentityClient } from "./WriterIdentityClient";
import { StoryCardTVL, StoryCardPrice } from "./StoryCardStats";
import { getStoryStatus } from "../../lib/story-status";

type FallbackVariant = "A" | "B" | "C" | "D";

function hashToVariant(id: number): FallbackVariant {
  const variants: FallbackVariant[] = ["A", "B", "C", "D"];
  return variants[((id * 2654435761) >>> 0) % 4];
}

const FALLBACK_STYLES: Record<FallbackVariant, React.CSSProperties> = {
  A: { background: "radial-gradient(circle at 30% 70%, oklch(30% 0.06 28 / 0.5) 0%, transparent 60%), linear-gradient(160deg, oklch(22% 0.03 50) 0%, oklch(16% 0.025 30) 100%)" },
  B: { background: "repeating-linear-gradient(-45deg, oklch(20% 0.02 50) 0px, oklch(20% 0.02 50) 2px, oklch(23% 0.025 50) 2px, oklch(23% 0.025 50) 12px)" },
  C: { background: "conic-gradient(from 45deg at 80% 20%, oklch(25% 0.04 280 / 0.3), transparent 120deg), linear-gradient(180deg, oklch(20% 0.03 260) 0%, oklch(15% 0.02 240) 100%)" },
  D: { background: "oklch(18% 0.035 50)" },
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
  const status = getStoryStatus(storyline);
  const isActive = status === "active";
  const variant = hashToVariant(storyline.storyline_id);

  return (
    <Link
      href={`/story/${storyline.storyline_id}`}
      className="group relative block aspect-[2/3] overflow-hidden rounded-[var(--card-radius)] transition-[transform,box-shadow] duration-200 ease-out hover:z-[2] hover:scale-[1.03] hover:shadow-[0_12px_40px_oklch(0%_0_0_/_0.5)]"
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
          <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center px-4 text-center">
            <div className="font-heading text-base font-semibold leading-tight text-[oklch(88%_0.012_70)] sm:text-lg" style={{ maxWidth: "90%" }}>
              {storyline.title}
            </div>
            <div className="mt-2 text-[11px] text-[oklch(55%_0.015_50)]">
              <WriterIdentityClient address={storyline.writer_address} writerType={storyline.writer_type} />
            </div>
            <div className="mt-2.5 h-0.5 w-8 rounded-sm bg-accent" />
          </div>
        </div>
      )}

      {/* Gradient overlay */}
      {coverUrl ? (
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,oklch(0%_0_0_/_0)_40%,oklch(0%_0_0_/_0.35)_60%,oklch(0%_0_0_/_0.85)_100%)]" />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,oklch(0%_0_0_/_0)_55%,oklch(0%_0_0_/_0.7)_100%)]" />
      )}

      {/* Top badges */}
      <div className="absolute top-2 right-2 left-2 z-[2] flex flex-wrap gap-1">
        {displayGenre && (
          <span className="rounded-[3px] bg-[oklch(0%_0_0_/_0.55)] px-[7px] py-[2px] text-[10px] font-semibold uppercase tracking-[0.03em] leading-[1.4] text-[oklch(92%_0.01_70)] backdrop-blur-sm">
            {displayGenre}
          </span>
        )}
        {storyline.writer_type === 1 && (
          <span className="rounded-[3px] bg-[oklch(55%_0.18_280_/_0.85)] px-[7px] py-[2px] text-[10px] font-semibold uppercase tracking-[0.03em] leading-[1.4] text-[oklch(95%_0.02_280)]">
            AI Writer
          </span>
        )}
        {status === "completed" && (
          <span className="rounded-[3px] bg-[oklch(55%_0.15_145_/_0.85)] px-[7px] py-[2px] text-[10px] font-semibold uppercase tracking-[0.03em] leading-[1.4] text-[oklch(95%_0.02_145)]">
            Completed
          </span>
        )}
        {isActive && (
          <span className="rounded-[3px] bg-[oklch(60%_0.15_80_/_0.85)] px-[7px] py-[2px] text-[10px] font-semibold uppercase tracking-[0.03em] leading-[1.4] text-[oklch(95%_0.02_80)]">
            Ongoing
          </span>
        )}
      </div>

      {/* Bottom card info */}
      <div className="absolute right-0 bottom-0 left-0 z-[2] px-2.5 pt-3 pb-2.5">
        {coverUrl && (
          <h3 className="font-heading text-[13px] font-semibold leading-[1.25] text-[oklch(97%_0.005_70)] line-clamp-2 sm:text-[15px]">
            {storyline.title}
          </h3>
        )}
        <div className="mt-[3px] text-[11px] text-[oklch(75%_0.01_70)]">
          <WriterIdentityClient address={storyline.writer_address} writerType={storyline.writer_type} />
        </div>
        {storyline.token_address && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="rounded-[3px] bg-[oklch(52%_0.14_28_/_0.15)] px-1.5 py-[2px] font-mono text-[10px] font-medium tabular-nums text-accent">
              <StoryCardPrice tokenAddress={storyline.token_address} />
            </span>
            <span className="font-mono text-[10px] tabular-nums text-[oklch(55%_0.01_50)]">
              <StoryCardTVL tokenAddress={storyline.token_address} />
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
