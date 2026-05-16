"use client";

import type { CartoonPanel } from "../../lib/cartoon-markdown";

interface CartoonPreviewProps {
  panels: CartoonPanel[];
}

export function CartoonPreview({ panels }: CartoonPreviewProps) {
  if (panels.length === 0) {
    return (
      <div className="flex items-center justify-center rounded border border-border px-4 py-12">
        <span className="text-muted text-xs">Upload images to preview your cartoon</span>
      </div>
    );
  }

  return (
    <div className="space-y-1 rounded border border-border bg-surface p-2 max-h-[500px] overflow-y-auto">
      {panels.map((panel, i) => (
        <div key={`${panel.cid}-${i}`}>
          {panel.label && (
            <p className="text-foreground text-xs font-semibold px-1 pt-2 pb-1">{panel.label}</p>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={panel.url}
            alt={panel.alt || `Panel ${i + 1}`}
            className="w-full rounded"
          />
        </div>
      ))}
    </div>
  );
}
