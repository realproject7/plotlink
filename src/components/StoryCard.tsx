import Link from "next/link";
import type { Storyline } from "../../lib/supabase";
import { WriterIdentityClient } from "./WriterIdentityClient";
import { StoryCardTVL } from "./StoryCardStats";
import { getStoryStatus } from "../../lib/story-status";

type FallbackVariant = "A" | "C" | "D";

function hashToVariant(id: number): FallbackVariant {
  const variants: FallbackVariant[] = ["A", "C", "D"];
  return variants[((id * 2654435761) >>> 0) % 3];
}

const FALLBACK_STYLES: Record<FallbackVariant, React.CSSProperties> = {
  A: { background: "radial-gradient(circle at 30% 70%, oklch(88% 0.03 28 / 0.4) 0%, transparent 60%), linear-gradient(160deg, oklch(93% 0.015 50) 0%, oklch(90% 0.012 30) 100%)" },
  C: { background: "radial-gradient(circle at 70% 30%, oklch(90% 0.02 280 / 0.3) 0%, transparent 50%), linear-gradient(180deg, oklch(94% 0.012 260) 0%, oklch(91% 0.01 240) 100%)" },
  D: { background: "linear-gradient(175deg, oklch(94% 0.015 50) 0%, oklch(90% 0.02 40) 100%)" },
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
      className="group relative block aspect-[2/3] overflow-hidden rounded-[var(--card-radius)] border border-[var(--border)] shadow-[0_1px_3px_oklch(0%_0_0_/_0.06)] transition-[transform,box-shadow] duration-200 ease-out hover:z-[2] hover:scale-[1.03] hover:shadow-[0_12px_40px_oklch(0%_0_0_/_0.12)]"
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
          <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center px-4 text-center">
            <div className="font-heading text-base font-semibold leading-tight text-[var(--fg)] sm:text-lg" style={{ maxWidth: "90%" }}>
              {storyline.title}
            </div>
            <div className="mt-2.5 h-0.5 w-8 rounded-sm bg-accent" />
          </div>
        </div>
      )}

      {/* Gradient overlay */}
      {coverUrl ? (
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,oklch(0%_0_0_/_0)_40%,oklch(0%_0_0_/_0.35)_60%,oklch(0%_0_0_/_0.85)_100%)]" />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,oklch(100%_0_0_/_0)_55%,oklch(100%_0_0_/_0.6)_100%)]" />
      )}

      {/* Top badges */}
      <div className="absolute top-2 right-2 left-2 z-[2] flex items-center gap-1">
        {displayGenre && (
          <span className="rounded-[3px] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-px text-[10px] font-medium uppercase tracking-wider leading-[1.4] text-[var(--muted)]">
            {displayGenre}
          </span>
        )}
        {storyline.writer_type === 1 && (
          <span className="rounded-[3px] border border-[oklch(70%_0.10_280)] bg-[oklch(94%_0.03_280)] px-1.5 py-px text-[10px] font-medium uppercase tracking-wider leading-[1.4] text-[oklch(45%_0.12_280)]">
            AI Writer
          </span>
        )}
        {status === "completed" && (
          <span className="rounded-[3px] border border-[oklch(70%_0.08_145)] bg-[oklch(94%_0.02_145)] px-1.5 py-px text-[10px] font-medium uppercase tracking-wider leading-[1.4] text-[oklch(40%_0.10_145)]">
            Completed
          </span>
        )}
        {isActive && (
          <span className="rounded-[3px] border border-[oklch(72%_0.08_80)] bg-[oklch(94%_0.02_80)] px-1.5 py-px text-[10px] font-medium uppercase tracking-wider leading-[1.4] text-[oklch(42%_0.10_80)]">
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
        <div className={`${coverUrl ? "mt-[3px]" : ""} text-[11px] ${coverUrl ? "text-[oklch(75%_0.01_70)]" : "text-[var(--muted)]"}`}>
          <WriterIdentityClient address={storyline.writer_address} writerType={storyline.writer_type} />
        </div>
        {storyline.token_address && (
          <div className="mt-1.5">
            <span className={`font-mono text-[10px] tabular-nums ${coverUrl ? "text-[oklch(55%_0.01_50)]" : "text-[var(--muted)]"}`}>
              <StoryCardTVL tokenAddress={storyline.token_address} />
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
