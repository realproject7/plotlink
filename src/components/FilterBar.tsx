"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { GENRES, LANGUAGES } from "../../lib/genres";

const SORT_OPTIONS = [
  { value: "new", label: "New" },
  { value: "trending", label: "Trending" },
  { value: "mcap", label: "Market Cap" },
] as const;

const WRITER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "human", label: "Human" },
  { value: "agent", label: "Agent" },
] as const;

export type WriterFilterValue = "all" | "human" | "agent";

interface FilterBarProps {
  writer: string;
  genre: string;
  lang: string;
  tab: string;
  totalCount?: number;
  showNsfw?: boolean;
  nsfwCount?: number;
}

function buildHref(params: { tab: string; writer: string; genre: string; lang: string; nsfw?: boolean }) {
  const sp = new URLSearchParams({ tab: params.tab });
  if (params.writer !== "all") sp.set("writer", params.writer);
  if (params.genre !== "all") sp.set("genre", params.genre);
  if (params.lang !== "all") sp.set("lang", params.lang);
  if (params.nsfw) sp.set("nsfw", "1");
  return `/?${sp.toString()}`;
}

function FilterSheetContent({
  onClose,
  writer,
  genre,
  lang,
  nsfw,
  onApply,
}: {
  onClose: () => void;
  writer: string;
  genre: string;
  lang: string;
  nsfw: boolean;
  onApply: (w: string, g: string, l: string, nsfw: boolean) => void;
}) {
  const [localWriter, setLocalWriter] = useState(writer);
  const [localGenre, setLocalGenre] = useState(genre);
  const [localLang, setLocalLang] = useState(lang);
  const [localNsfw, setLocalNsfw] = useState(nsfw);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-[var(--bg)] pb-8 pt-3 shadow-[0_-4px_20px_oklch(0%_0_0_/_0.15)]">
        {/* Handle */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[var(--border)]" />

        <div className="space-y-5 px-5">
          {/* Writer */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Writer</div>
            <div className="flex gap-1.5">
              {WRITER_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setLocalWriter(value)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    localWriter === value
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-bg)]"
                      : "border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Genre */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Genre</div>
            <div className="relative">
              <select
                value={localGenre}
                onChange={(e) => setLocalGenre(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none"
              >
                <option value="all">All Genres</option>
                {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          {/* Language */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Language</div>
            <div className="relative">
              <select
                value={localLang}
                onChange={(e) => setLocalLang(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none"
              >
                <option value="all">All Languages</option>
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* NSFW */}
          <div>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={localNsfw}
                onChange={(e) => setLocalNsfw(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
              />
              <span className="text-sm text-[var(--fg)]">Show 18+ content</span>
            </label>
          </div>

          {/* Apply */}
          <button
            onClick={() => { onApply(localWriter, localGenre, localLang, localNsfw); onClose(); }}
            className="w-full rounded-lg bg-[var(--accent)] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterSheet({ open, ...props }: { open: boolean; onClose: () => void; writer: string; genre: string; lang: string; nsfw: boolean; onApply: (w: string, g: string, l: string, nsfw: boolean) => void }) {
  if (!open) return null;
  return <FilterSheetContent {...props} />;
}

export function FilterBar({ writer, genre, lang, tab, totalCount, showNsfw = false, nsfwCount = 0 }: FilterBarProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const nsfw = showNsfw;

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("lang") || urlParams.has("nsfw")) return;
    try {
      const savedLang = localStorage.getItem("plotlink_lang");
      const savedNsfw = localStorage.getItem("plotlink_nsfw") === "1";
      if ((savedLang && savedLang !== "all" && (LANGUAGES as readonly string[]).includes(savedLang)) || savedNsfw) {
        router.replace(buildHref({ tab, writer, genre, lang: savedLang && savedLang !== "all" ? savedLang : lang, nsfw: savedNsfw }));
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function navigate(params: { tab: string; writer: string; genre: string; lang: string; nsfw?: boolean }) {
    try {
      localStorage.setItem("plotlink_lang", params.lang);
      localStorage.setItem("plotlink_nsfw", params.nsfw ? "1" : "0");
    } catch {}
    router.push(buildHref(params));
  }

  const handleApplyFilters = useCallback((w: string, g: string, l: string, n: boolean) => {
    navigate({ tab, writer: w, genre: g, lang: l, nsfw: n });
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeFilterCount = [writer !== "all", genre !== "all", lang !== "all", nsfw].filter(Boolean).length;
  const activeChips: { label: string; clear: () => void }[] = [];
  if (writer !== "all") activeChips.push({ label: `Writer: ${writer}`, clear: () => navigate({ tab, writer: "all", genre, lang, nsfw }) });
  if (genre !== "all") activeChips.push({ label: genre, clear: () => navigate({ tab, writer, genre: "all", lang, nsfw }) });
  if (lang !== "all") activeChips.push({ label: lang, clear: () => navigate({ tab, writer, genre, lang: "all", nsfw }) });
  if (nsfw) activeChips.push({ label: "18+", clear: () => navigate({ tab, writer, genre, lang, nsfw: false }) });

  return (
    <>
      <div className="border-b border-[var(--border)] py-3 sm:py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Sort tabs — underline style */}
          <div className="flex items-center gap-0">
            {SORT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => navigate({ tab: value, writer, genre, lang, nsfw })}
                className={`relative px-3 py-2 text-[13px] font-medium transition-colors sm:text-sm ${
                  tab === value
                    ? "font-semibold text-[var(--fg)]"
                    : "text-[var(--muted)] hover:text-[var(--fg)]"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {label}
                  {tab === value && (
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="opacity-50">
                      <path d="M4 6l4-3 4 3M4 10l4 3 4-3" />
                    </svg>
                  )}
                </span>
                {tab === value && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-[var(--accent)]" />
                )}
              </button>
            ))}
          </div>

          {/* Desktop filters — hidden on mobile */}
          <div className="hidden items-center gap-2 sm:flex">
            {/* Writer pills — segmented control */}
            <div className="flex items-center rounded-full border border-[var(--border)] p-0.5">
              {WRITER_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => navigate({ tab, writer: value, genre, lang, nsfw })}
                  className={`rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors ${
                    writer === value
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Genre pill */}
            <div className="relative">
              <select
                value={genre}
                onChange={(e) => navigate({ tab, writer, genre: e.target.value, lang, nsfw })}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors focus:border-[var(--accent)] focus:outline-none ${
                  genre !== "all"
                    ? "border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-transparent text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--fg)]"
                }`}
              >
                <option value="all">Genre</option>
                {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* Language pill */}
            <div className="relative">
              <select
                value={lang}
                onChange={(e) => navigate({ tab, writer, genre, lang: e.target.value, nsfw })}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors focus:border-[var(--accent)] focus:outline-none ${
                  lang !== "all"
                    ? "border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-transparent text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--fg)]"
                }`}
              >
                <option value="all">Language</option>
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {/* NSFW toggle */}
            <label className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              nsfw
                ? "border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--fg)]"
            }`}>
              <input
                type="checkbox"
                checked={nsfw}
                onChange={(e) => navigate({ tab, writer, genre, lang, nsfw: e.target.checked })}
                className="h-3 w-3 rounded accent-[var(--accent)]"
              />
              18+
            </label>

            {/* Result count */}
            {totalCount !== undefined && (
              <span className="ml-1 text-[12px] tabular-nums text-[var(--muted)]">
                {totalCount} {totalCount === 1 ? "story" : "stories"}
              </span>
            )}
          </div>

          {/* Mobile filter button */}
          <button
            onClick={() => setSheetOpen(true)}
            className={`relative flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:hidden ${
              activeFilterCount > 0
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filter
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* NSFW filter feedback */}
        {nsfw && nsfwCount === 0 && (
          <p className="mt-2 text-[11px] text-[var(--muted)]">
            No 18+ stories found — all current stories are safe for work.
          </p>
        )}
        {nsfw && nsfwCount > 0 && (
          <p className="mt-2 text-[11px] text-[var(--muted)]">
            Showing {nsfwCount} {nsfwCount === 1 ? "mature story" : "mature stories"} alongside regular content.
          </p>
        )}

        {/* Mobile active filter chips */}
        {activeChips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 sm:hidden">
            {activeChips.map((chip) => (
              <button
                key={chip.label}
                onClick={chip.clear}
                className="flex items-center gap-1 rounded-full border border-[var(--accent)] bg-[var(--accent-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent)]"
              >
                {chip.label}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        writer={writer}
        genre={genre}
        lang={lang}
        nsfw={nsfw}
        onApply={handleApplyFilters}
      />
    </>
  );
}
