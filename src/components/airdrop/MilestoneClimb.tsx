"use client";

import { useEffect, useState } from "react";

interface StatusData {
  currentFdv: number;
  latestPriceUsd: number | null;
  poolAmount: number;
  milestones: {
    bronze: { mcap: number; pct: number; reached: boolean };
    silver: { mcap: number; pct: number; reached: boolean };
    gold: { mcap: number; pct: number; reached: boolean };
    diamond: { mcap: number; pct: number; reached: boolean };
  };
}

interface MilestoneClimbProps {
  dimmed?: boolean;
}

const TIERS = [
  { key: "bronze", emoji: "\u{1F949}", label: "Bronze", cx: 140, cy: 164 },
  { key: "silver", emoji: "\u{1F948}", label: "Silver", cx: 260, cy: 125 },
  { key: "gold", emoji: "\u{1F947}", label: "Gold", cx: 400, cy: 55 },
  { key: "diamond", emoji: "\u{1F48E}", label: "Diamond", cx: 530, cy: 18 },
] as const;

function formatMcap(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function formatPool(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  if (n >= 1) return `$${Math.round(n)}`;
  return "$0";
}

function interpolateFdvX(fdv: number, milestones: StatusData["milestones"]): number {
  const mcaps = [milestones.bronze.mcap, milestones.silver.mcap, milestones.gold.mcap, milestones.diamond.mcap];
  const xs = [140, 260, 400, 530];

  if (fdv <= 0) return 30;
  if (fdv >= mcaps[3]) return 530;

  const logFdv = Math.log10(fdv);
  const logMin = Math.log10(mcaps[0] * 0.1);

  for (let i = 0; i < mcaps.length; i++) {
    if (fdv <= mcaps[i]) {
      const prevX = i === 0 ? 30 : xs[i - 1];
      const prevLog = i === 0 ? logMin : Math.log10(mcaps[i - 1]);
      const curLog = Math.log10(mcaps[i]);
      const t = (logFdv - prevLog) / (curLog - prevLog);
      return prevX + t * (xs[i] - prevX);
    }
  }
  return 530;
}

function interpolateFdvY(x: number): number {
  const points = [[30, 175], [140, 164], [260, 125], [400, 55], [530, 18]];
  for (let i = 1; i < points.length; i++) {
    if (x <= points[i][0]) {
      const t = (x - points[i - 1][0]) / (points[i][0] - points[i - 1][0]);
      return points[i - 1][1] + t * (points[i][1] - points[i - 1][1]);
    }
  }
  return 18;
}

export function MilestoneClimb({ dimmed }: MilestoneClimbProps) {
  const [status, setStatus] = useState<StatusData | null>(null);

  useEffect(() => {
    fetch("/api/airdrop/status")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStatus(d); })
      .catch(() => {});
  }, []);

  if (!status) {
    return (
      <div className="border-[var(--border)] rounded border p-4">
        <p className="text-[var(--muted)] text-xs">Loading milestone chart...</p>
      </div>
    );
  }

  const { milestones, currentFdv, latestPriceUsd, poolAmount } = status;
  const plotPrice = latestPriceUsd ?? 0;

  const tierData = TIERS.map(t => {
    const m = milestones[t.key as keyof typeof milestones];
    return {
      ...t,
      mcap: m.mcap,
      pct: m.pct,
      reached: m.reached,
      poolUsd: (poolAmount * m.pct / 100) * plotPrice,
    };
  });

  const fdvX = interpolateFdvX(currentFdv, milestones);
  const fdvY = interpolateFdvY(fdvX);

  return (
    <div className={`border-[var(--border)] rounded border p-5 ${dimmed ? "opacity-50" : ""}`}>
      <div className="relative">
        <svg viewBox="0 0 560 200" className="w-full" style={{ maxHeight: 220 }}>
          <defs>
            <linearGradient id="gold-grad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--gold-1)" />
              <stop offset="100%" stopColor="var(--gold-2)" />
            </linearGradient>
            <linearGradient id="gold-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gold-1)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--gold-1)" stopOpacity="0.03" />
            </linearGradient>
          </defs>

          <path
            d="M30,175 C80,172 140,165 200,148 C260,125 340,85 420,50 C460,35 500,22 540,15 L540,180 L30,180 Z"
            fill="url(#gold-area-grad)"
          />
          <path
            d="M30,175 C80,172 140,165 200,148 C260,125 340,85 420,50 C460,35 500,22 540,15"
            fill="none"
            stroke="url(#gold-grad)"
            strokeWidth="2.5"
          />

          {tierData.map(t => (
            <g key={t.key}>
              <line x1={t.cx} y1={t.cy} x2={t.cx} y2={180} stroke="var(--border)" strokeWidth="1" strokeDasharray="3,3" />
              <circle cx={t.cx} cy={t.cy} r={t.reached ? 8 : 6} fill={t.reached ? "var(--gold-2)" : "var(--bg)"} stroke="var(--gold-2)" strokeWidth="1.5" />
              <text x={t.cx} y={t.cy - 14} textAnchor="middle" fontSize="14">{t.emoji}</text>
            </g>
          ))}

          <circle cx={fdvX} cy={fdvY} r="5" fill="var(--accent)" opacity="0.9">
            <animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" />
          </circle>
        </svg>

        <div
          className="absolute text-[10px] font-bold text-[var(--accent)]"
          style={{ left: `${(fdvX / 560) * 100}%`, top: "0", transform: "translateX(-50%)" }}
        >
          TODAY {formatMcap(currentFdv)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tierData.map(t => (
          <div key={t.key} className="space-y-0.5">
            <div className="text-[var(--fg)] text-xs font-medium">{t.emoji} {t.label}</div>
            <div className="text-[var(--muted)] font-mono text-[10px]">{formatMcap(t.mcap)}</div>
            <div className="text-[var(--muted)] text-[10px]">&rarr; ~{formatPool(t.poolUsd)} pool</div>
          </div>
        ))}
      </div>
    </div>
  );
}
