"use client";

import { useQuery } from "@tanstack/react-query";

interface RatingsResponse {
  average: number;
  count: number;
}

export function RatingSummary({ storylineId }: { storylineId: number }) {
  const { data } = useQuery<RatingsResponse>({
    queryKey: ["ratings", storylineId],
    queryFn: async () => {
      const res = await fetch(`/api/ratings?storylineId=${storylineId}`);
      if (!res.ok) throw new Error("Failed to fetch ratings");
      return res.json();
    },
  });

  if (!data || data.count === 0) return null;

  return (
    <span>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={star <= Math.round(data.average) ? "text-accent" : "text-muted"}
        >
          *
        </span>
      ))}{" "}
      {data.average.toFixed(1)} ({data.count})
    </span>
  );
}
