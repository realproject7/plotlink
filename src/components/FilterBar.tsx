"use client";

import { useEffect } from "react";
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
}

function buildHref(params: { tab: string; writer: string; genre: string; lang: string }) {
  const sp = new URLSearchParams({ tab: params.tab });
  if (params.writer !== "all") sp.set("writer", params.writer);
  if (params.genre !== "all") sp.set("genre", params.genre);
  if (params.lang !== "all") sp.set("lang", params.lang);
  return `/?${sp.toString()}`;
}

export function FilterBar({ writer, genre, lang, tab, totalCount }: FilterBarProps) {
  const router = useRouter();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("lang")) return;
    try {
      const saved = localStorage.getItem("plotlink_lang");
      if (saved && saved !== "all" && (LANGUAGES as readonly string[]).includes(saved)) {
        router.replace(buildHref({ tab, writer, genre, lang: saved }));
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function navigate(params: { tab: string; writer: string; genre: string; lang: string }) {
    try { localStorage.setItem("plotlink_lang", params.lang); } catch {}
    router.push(buildHref(params));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: Sort tabs + Writer pills */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sort tab group */}
        <div className="flex items-center gap-1 rounded-md bg-surface p-1">
          {SORT_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => navigate({ tab: value, writer, genre, lang })}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                tab === value
                  ? "bg-accent-bg text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Writer pill group */}
        <div className="flex items-center gap-1">
          {WRITER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => navigate({ tab, writer: value, genre, lang })}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                writer === value
                  ? "border-accent text-accent bg-accent-bg"
                  : "border-border text-muted hover:text-foreground hover:border-foreground/20"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Genre select */}
        <select
          value={genre}
          onChange={(e) => navigate({ tab, writer, genre: e.target.value, lang })}
          className="rounded-full border border-border bg-transparent px-3 py-1 text-xs text-muted transition-colors hover:border-foreground/20 hover:text-foreground focus:border-accent focus:text-foreground focus:outline-none"
        >
          <option value="all">All Genres</option>
          {GENRES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        {/* Language select */}
        <select
          value={lang}
          onChange={(e) => navigate({ tab, writer, genre, lang: e.target.value })}
          className="rounded-full border border-border bg-transparent px-3 py-1 text-xs text-muted transition-colors hover:border-foreground/20 hover:text-foreground focus:border-accent focus:text-foreground focus:outline-none"
        >
          <option value="all">All Languages</option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        {/* Result count — right aligned */}
        {totalCount !== undefined && (
          <span className="ml-auto text-xs text-muted">
            {totalCount} {totalCount === 1 ? "story" : "stories"}
          </span>
        )}
      </div>
    </div>
  );
}
