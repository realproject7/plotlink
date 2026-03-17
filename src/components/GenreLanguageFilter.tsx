"use client";

import { GENRES, LANGUAGES } from "../../lib/genres";

export function GenreFilter({ active, tab, writer, lang }: { active: string; tab: string; writer: string; lang: string }) {
  return (
    <select
      defaultValue={active}
      onChange={(e) => {
        const params = new URLSearchParams({ tab });
        if (writer !== "all") params.set("writer", writer);
        if (e.target.value !== "all") params.set("genre", e.target.value);
        if (lang !== "all") params.set("lang", lang);
        window.location.href = `/?${params.toString()}`;
      }}
      className="border-border bg-surface text-muted rounded border px-2 py-1 text-xs"
    >
      <option value="all">All genres</option>
      {GENRES.map((g) => (
        <option key={g} value={g}>{g}</option>
      ))}
    </select>
  );
}

export function LanguageFilter({ active, tab, writer, genre }: { active: string; tab: string; writer: string; genre: string }) {
  return (
    <select
      defaultValue={active}
      onChange={(e) => {
        const params = new URLSearchParams({ tab });
        if (writer !== "all") params.set("writer", writer);
        if (genre !== "all") params.set("genre", genre);
        if (e.target.value !== "all") params.set("lang", e.target.value);
        window.location.href = `/?${params.toString()}`;
      }}
      className="border-border bg-surface text-muted rounded border px-2 py-1 text-xs"
    >
      <option value="all">All languages</option>
      {LANGUAGES.map((l) => (
        <option key={l} value={l}>{l}</option>
      ))}
    </select>
  );
}
