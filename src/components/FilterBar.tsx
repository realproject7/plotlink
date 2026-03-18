"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GENRES, LANGUAGES } from "../../lib/genres";

const WRITER_OPTIONS = ["All", "Human", "AI"] as const;
const SORT_OPTIONS = [
  { value: "new", label: "Recent" },
  { value: "trending", label: "Trending" },
  { value: "rising", label: "Rising" },
  { value: "completed", label: "Completed" },
] as const;

type FilterKey = "writer" | "genre" | "lang" | "sort";

interface FilterBarProps {
  writer: string;
  genre: string;
  lang: string;
  tab: string;
}

function buildHref(params: { tab: string; writer: string; genre: string; lang: string }) {
  const sp = new URLSearchParams({ tab: params.tab });
  if (params.writer !== "all") sp.set("writer", params.writer);
  if (params.genre !== "all") sp.set("genre", params.genre);
  if (params.lang !== "all") sp.set("lang", params.lang);
  return `/?${sp.toString()}`;
}

function writerDisplay(v: string) {
  if (v === "agent") return "AI";
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function sortLabel(tab: string) {
  return SORT_OPTIONS.find((o) => o.value === tab)?.label ?? "Recent";
}

export function FilterBar({ writer, genre, lang, tab }: FilterBarProps) {
  const [open, setOpen] = useState<FilterKey | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpen(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(key: FilterKey) {
    setOpen(open === key ? null : key);
  }

  function navigate(params: { tab: string; writer: string; genre: string; lang: string }) {
    setOpen(null);
    router.push(buildHref(params));
  }

  return (
    <div ref={barRef} className="relative">
      <div className="border-border flex items-center gap-x-3 rounded border px-3 py-2 text-xs">
        {/* Writer token */}
        <Token
          label="writer"
          value={writerDisplay(writer)}
          active={open === "writer"}
          onClick={() => toggle("writer")}
        />

        {/* Genre token */}
        <Token
          label="genre"
          value={genre === "all" ? "All" : genre}
          active={open === "genre"}
          onClick={() => toggle("genre")}
        />

        {/* Language token */}
        <Token
          label="lang"
          value={lang === "all" ? "All" : lang}
          active={open === "lang"}
          onClick={() => toggle("lang")}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sort — icon on mobile, full label on sm+ */}
        <button
          onClick={() => toggle("sort")}
          className={`text-muted hover:text-foreground shrink-0 transition-colors ${open === "sort" ? "text-accent" : ""}`}
        >
          <span className="sm:hidden">{"\u2195"}</span>
          <span className="hidden sm:inline">
            <span className="text-muted">sort:</span>
            <span className="text-accent">{sortLabel(tab)}</span>
          </span>
        </button>
      </div>

      {/* Dropdowns */}
      {open === "writer" && (
        <Dropdown>
          {WRITER_OPTIONS.map((opt) => {
            const val = opt.toLowerCase() === "ai" ? "agent" : opt.toLowerCase();
            return (
              <DropdownItem
                key={val}
                label={opt}
                active={writer === val}
                onClick={() => navigate({ tab, writer: val, genre, lang })}
              />
            );
          })}
        </Dropdown>
      )}

      {open === "genre" && (
        <Dropdown>
          <DropdownItem
            label="All genres"
            active={genre === "all"}
            onClick={() => navigate({ tab, writer, genre: "all", lang })}
          />
          {GENRES.map((g) => (
            <DropdownItem
              key={g}
              label={g}
              active={genre === g}
              onClick={() => navigate({ tab, writer, genre: g, lang })}
            />
          ))}
        </Dropdown>
      )}

      {open === "lang" && (
        <Dropdown>
          <DropdownItem
            label="All languages"
            active={lang === "all"}
            onClick={() => navigate({ tab, writer, genre, lang: "all" })}
          />
          {LANGUAGES.map((l) => (
            <DropdownItem
              key={l}
              label={l}
              active={lang === l}
              onClick={() => navigate({ tab, writer, genre, lang: l })}
            />
          ))}
        </Dropdown>
      )}

      {open === "sort" && (
        <Dropdown align="right">
          {SORT_OPTIONS.map(({ value, label }) => (
            <DropdownItem
              key={value}
              label={label}
              active={tab === value}
              onClick={() => navigate({ tab: value, writer, genre, lang })}
            />
          ))}
        </Dropdown>
      )}
    </div>
  );
}

function Token({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap transition-colors hover:opacity-80 ${active ? "opacity-80" : ""}`}
    >
      <span className="text-muted">{label}:</span>
      <span className="text-accent">{value}</span>
    </button>
  );
}

function Dropdown({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <div
      className={`border-border bg-[var(--bg)] absolute top-full z-20 mt-1 max-h-60 overflow-y-auto rounded border py-1 shadow-lg ${
        align === "right" ? "right-0" : "left-0"
      }`}
    >
      {children}
    </div>
  );
}

function DropdownItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full whitespace-nowrap px-4 py-1.5 text-left text-xs transition-colors ${
        active ? "text-accent bg-accent/10" : "text-muted hover:text-foreground hover:bg-[var(--border)]/30"
      }`}
    >
      {label}
    </button>
  );
}
