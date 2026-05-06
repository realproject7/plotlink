"use client";

import { type Address } from "viem";
import { type Storyline } from "../../lib/supabase";
import { BatchTokenDataProvider } from "./BatchTokenDataProvider";
import { StoryCard } from "./StoryCard";

export function StoryGrid({ storylines }: { storylines: Storyline[] }) {
  const tokenAddresses = storylines
    .map((s) => s.token_address)
    .filter((addr): addr is string => !!addr) as Address[];

  return (
    <BatchTokenDataProvider tokenAddresses={tokenAddresses}>
      <div className="mt-4 grid grid-cols-2 gap-[var(--card-gap)] lg:grid-cols-3 xl:grid-cols-4">
        {storylines.map((s) => (
          <StoryCard key={s.id} storyline={s} />
        ))}
      </div>
    </BatchTokenDataProvider>
  );
}
