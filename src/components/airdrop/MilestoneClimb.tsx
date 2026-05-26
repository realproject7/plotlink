"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

interface StatusData {
  currentFdv: number;
  milestones: {
    bronze: { mcap: number; pct: number; reached: boolean };
    silver: { mcap: number; pct: number; reached: boolean };
    gold: { mcap: number; pct: number; reached: boolean };
    diamond: { mcap: number; pct: number; reached: boolean };
  };
}

interface ProjectionData {
  projected_share: { bronze: number; silver: number; gold: number; diamond: number };
}

interface MilestoneClimbProps {
  dimmed?: boolean;
}

const TIERS = ["bronze", "silver", "gold", "diamond"] as const;
const TIER_LABELS: Record<typeof TIERS[number], string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

function formatMcap(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export function MilestoneClimb({ dimmed }: MilestoneClimbProps) {
  const { address, isConnected } = useAccount();
  const [status, setStatus] = useState<StatusData | null>(null);
  const [projection, setProjection] = useState<ProjectionData | null>(null);

  useEffect(() => {
    fetch("/api/airdrop/status")
      .then(r => r.ok ? r.json() : null)
      .then(d => setStatus(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isConnected || !address || dimmed) return;
    fetch(`/api/airdrop/projection?address=${address.toLowerCase()}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setProjection(d))
      .catch(() => {});
  }, [isConnected, address, dimmed]);

  if (!status) {
    return (
      <div className="border-border rounded border p-4">
        <h3 className="text-accent mb-1 text-xs font-bold uppercase tracking-wider">Milestone Climb</h3>
        <p className="text-muted text-xs">Loading...</p>
      </div>
    );
  }

  const { milestones, currentFdv } = status;
  const tierData = TIERS.map(tier => ({
    key: tier,
    label: TIER_LABELS[tier],
    mcap: milestones[tier].mcap,
    pct: milestones[tier].pct,
    reached: milestones[tier].reached,
    share: projection?.projected_share[tier] ?? 0,
  }));

  const minMcap = tierData[0].mcap;
  const maxMcap = tierData[tierData.length - 1].mcap;
  const logMin = Math.log10(minMcap * 0.5);
  const logMax = Math.log10(maxMcap * 1.5);
  const logRange = logMax - logMin;

  const svgW = 300;
  const svgH = 160;
  const padX = 40;
  const padY = 20;
  const chartW = svgW - padX * 2;
  const chartH = svgH - padY * 2;

  function xPos(mcap: number) {
    const logVal = Math.log10(Math.max(mcap, 1));
    const normalized = Math.max(0, Math.min(1, (logVal - logMin) / logRange));
    return padX + normalized * chartW;
  }

  const fdvX = xPos(currentFdv);
  const lineY = padY + chartH * 0.5;

  return (
    <div className={`border-border rounded border p-4 ${dimmed ? "opacity-40" : ""}`}>
      <h3 className="text-accent mb-3 text-xs font-bold uppercase tracking-wider">Milestone Climb</h3>

      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ maxHeight: 180 }}>
        {/* Baseline */}
        <line x1={padX} y1={lineY} x2={svgW - padX} y2={lineY} stroke="var(--border)" strokeWidth={1} />

        {/* Tier nodes */}
        {tierData.map(t => {
          const cx = xPos(t.mcap);
          return (
            <g key={t.key}>
              <line x1={cx} y1={lineY - 8} x2={cx} y2={lineY + 8} stroke="var(--border)" strokeWidth={1} strokeDasharray="2,2" />
              <circle
                cx={cx}
                cy={lineY}
                r={6}
                fill={t.reached ? "var(--accent)" : "var(--bg)"}
                stroke={t.reached ? "var(--accent)" : "var(--border)"}
                strokeWidth={1.5}
              />
              <text x={cx} y={lineY - 14} textAnchor="middle" fill="var(--muted)" fontSize={8}>
                {t.label}
              </text>
              <text x={cx} y={lineY + 22} textAnchor="middle" fill="var(--muted)" fontSize={7}>
                {formatMcap(t.mcap)}
              </text>
              {!dimmed && t.share > 0 && (
                <text x={cx} y={lineY + 34} textAnchor="middle" fill="var(--accent)" fontSize={7}>
                  {Math.round(t.share).toLocaleString()} PLOT
                </text>
              )}
            </g>
          );
        })}

        {/* Current FDV marker */}
        <line x1={fdvX} y1={lineY - 16} x2={fdvX} y2={lineY + 16} stroke="var(--accent)" strokeWidth={1.5} />
        <polygon
          points={`${fdvX - 4},${lineY - 18} ${fdvX + 4},${lineY - 18} ${fdvX},${lineY - 12}`}
          fill="var(--accent)"
        />
        <text x={fdvX} y={lineY + 46} textAnchor="middle" fill="var(--accent)" fontSize={8} fontWeight="bold">
          {formatMcap(currentFdv)}
        </text>
      </svg>
    </div>
  );
}
