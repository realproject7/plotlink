"use client";

import { useAccount } from "wagmi";
import Link from "next/link";

export function AddPlotButton({
  storylineId,
  writerAddress,
}: {
  storylineId: number;
  writerAddress: string;
}) {
  const { address } = useAccount();
  if (!address || address.toLowerCase() !== writerAddress.toLowerCase())
    return null;
  return (
    <Link
      href={`/create?tab=chain&storyline=${storylineId}`}
      className="border-accent text-accent hover:bg-accent/10 mt-3 block w-full rounded border py-2 text-center text-xs font-medium transition-colors"
    >
      + Add a new Plot
    </Link>
  );
}
