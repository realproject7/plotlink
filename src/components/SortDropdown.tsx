"use client";

import { useRouter } from "next/navigation";
import { Select } from "./Select";

const SORT_OPTIONS = [
  { value: "new", label: "Recent" },
  { value: "trending", label: "Trending" },
  { value: "rising", label: "Rising" },
  { value: "completed", label: "Completed" },
];

interface SortDropdownProps {
  active: string;
  writer: string;
  basePath?: string;
}

export function SortDropdown({ active, writer, basePath = "/" }: SortDropdownProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted text-xs">Sort:</span>
      <Select
        value={active}
        onChange={(v) => {
          const params = new URLSearchParams({ tab: v });
          if (writer && writer !== "all") params.set("writer", writer);
          router.push(`${basePath}?${params.toString()}`);
        }}
        options={SORT_OPTIONS}
        className="w-36"
      />
    </div>
  );
}
