"use client";

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
 * A single bookshelf row: books sitting on a visible shelf surface.
 */
function ShelfRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative pb-3">
      {/* Books */}
      <div className="relative z-10 grid grid-cols-2 gap-x-4 gap-y-0 lg:grid-cols-3">
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
 * Books are displayed on shelves — each row of 2 (mobile) or 3 (desktop)
 * books sits on a visible shelf surface.
 */
export function StoryGrid({ storylines }: { storylines: Storyline[] }) {
  const tokenAddresses = storylines
    .map((s) => s.token_address)
    .filter((addr): addr is string => !!addr) as Address[];

  // We chunk by 3 (desktop cols) — CSS handles showing 2 cols on mobile
  const shelves = chunk(storylines, 3);

  return (
    <BatchTokenDataProvider tokenAddresses={tokenAddresses}>
      <div className="mt-6 flex flex-col gap-6">
        {shelves.map((shelf, i) => (
          <ShelfRow key={i}>
            {shelf.map((s) => (
              <StoryCard key={s.id} storyline={s} />
            ))}
          </ShelfRow>
        ))}
      </div>
    </BatchTokenDataProvider>
  );
}
