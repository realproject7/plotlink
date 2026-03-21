"use client";

import { useState, useEffect } from "react";
import { type Address } from "viem";
import { type Storyline } from "../../lib/supabase";
import { BatchTokenDataProvider } from "./BatchTokenDataProvider";
import { StoryCard } from "./StoryCard";

/**
 * Groups an array into chunks of the given size.
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * Hook that returns the current shelf size (columns per row).
 * Uses matchMedia to stay in sync with the CSS breakpoint.
 */
function useShelfSize(): number {
  const [cols, setCols] = useState(3);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const update = () => setCols(mql.matches ? 3 : 2);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return cols;
}

/**
 * A single bookshelf row: books sitting on a visible shelf surface.
 */
function ShelfRow({ children, cols }: { children: React.ReactNode; cols: number }) {
  return (
    <div className="relative pb-3">
      {/* Books */}
      <div
        className="relative z-10 grid gap-x-4 gap-y-0"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {children}
      </div>

      {/* Shelf surface */}
      <div
        className="relative -mt-1 h-3 rounded-b-sm"
        style={{
          background: "linear-gradient(to bottom, var(--bg-shelf), #D0C4B0)",
          boxShadow: "0 4px 8px -2px var(--shelf-shadow), 0 2px 4px -1px var(--shelf-shadow)",
        }}
      />
      {/* Shelf front edge */}
      <div
        className="h-[2px]"
        style={{
          background: "linear-gradient(to right, transparent, var(--border), transparent)",
        }}
      />
    </div>
  );
}

/**
 * Story card grid wrapped in BatchTokenDataProvider.
 * Fetches price + TVL for all visible stories in a single multicall
 * instead of 4 individual RPC calls per card.
 *
 * Books are displayed on shelves — each visual row of books sits on
 * a visible shelf surface. Shelf size adapts to viewport (2 on mobile, 3 on desktop).
 */
export function StoryGrid({ storylines }: { storylines: Storyline[] }) {
  const tokenAddresses = storylines
    .map((s) => s.token_address)
    .filter((addr): addr is string => !!addr) as Address[];

  const cols = useShelfSize();
  const shelves = chunk(storylines, cols);

  return (
    <BatchTokenDataProvider tokenAddresses={tokenAddresses}>
      <div className="mt-6 flex flex-col gap-6">
        {shelves.map((shelf, i) => (
          <ShelfRow key={`${cols}-${i}`} cols={cols}>
            {shelf.map((s) => (
              <StoryCard key={s.id} storyline={s} />
            ))}
          </ShelfRow>
        ))}
      </div>
    </BatchTokenDataProvider>
  );
}
