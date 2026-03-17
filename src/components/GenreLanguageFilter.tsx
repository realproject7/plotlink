"use client";

import { GENRES, LANGUAGES } from "../../lib/genres";
import { DropdownSelect } from "./DropdownSelect";

const genreOptions = [
  { value: "all", label: "All genres" },
  ...GENRES.map((g) => ({ value: g, label: g })),
];

const languageOptions = [
  { value: "all", label: "All languages" },
  ...LANGUAGES.map((l) => ({ value: l, label: l })),
];

export function GenreFilter({ active, tab, writer, lang }: { active: string; tab: string; writer: string; lang: string }) {
  return (
    <DropdownSelect
      value={active}
      onChange={(value) => {
        const params = new URLSearchParams({ tab });
        if (writer !== "all") params.set("writer", writer);
        if (value !== "all") params.set("genre", value);
        if (lang !== "all") params.set("lang", lang);
        window.location.href = `/?${params.toString()}`;
      }}
      options={genreOptions}
      size="sm"
      className="w-32"
    />
  );
}

export function LanguageFilter({ active, tab, writer, genre }: { active: string; tab: string; writer: string; genre: string }) {
  return (
    <DropdownSelect
      value={active}
      onChange={(value) => {
        const params = new URLSearchParams({ tab });
        if (writer !== "all") params.set("writer", writer);
        if (genre !== "all") params.set("genre", genre);
        params.set("lang", value);
        window.location.href = `/?${params.toString()}`;
      }}
      options={languageOptions}
      size="sm"
      className="w-36"
    />
  );
}
