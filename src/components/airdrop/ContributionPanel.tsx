"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

interface ProjectionData {
  address: string;
  buy_volume: number;
  qualified_refs: number;
  has_fc_bonus: boolean;
  multiplier: number;
  weighted_spend: number;
  community_total: number;
  projected_share: {
    bronze: number;
    silver: number;
    gold: number;
    diamond: number;
  };
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="text-muted text-[10px] uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-bold ${accent ? "text-accent" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

export function ContributionPanel() {
  const { address, isConnected } = useAccount();
  const [data, setData] = useState<ProjectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/airdrop/projection?address=${address.toLowerCase()}`)
      .then(res => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError("Failed to load contribution data."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [isConnected, address]);

  if (loading) {
    return (
      <div className="border-border rounded border p-6">
        <p className="text-muted text-xs">Loading contribution data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-border rounded border p-6">
        <p className="text-[var(--danger)] text-xs">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="border-border rounded border p-6">
        <h2 className="text-accent mb-2 text-sm font-bold uppercase tracking-wider">Your Contribution</h2>
        <p className="text-muted text-xs">Buy PLOT tokens to start earning your share of the airdrop pool.</p>
      </div>
    );
  }

  const currentShare = data.community_total > 0
    ? (data.weighted_spend / data.community_total * 100).toFixed(2)
    : "0.00";

  return (
    <div className="border-border rounded border p-6 space-y-5">
      <h2 className="text-accent text-sm font-bold uppercase tracking-wider">Your Contribution</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Your Spend" value={`${data.buy_volume.toLocaleString()} PLOT`} />
        <Stat label="Qualified Refs" value={String(data.qualified_refs)} />
        <Stat
          label="FC Bonus"
          value={data.has_fc_bonus ? "Active" : "Not Active"}
          accent={data.has_fc_bonus}
        />
        <Stat label="Multiplier" value={`${data.multiplier.toFixed(1)}×`} accent />
        <Stat label="Weighted Spend" value={data.weighted_spend.toLocaleString()} />
        <Stat label="Share" value={`${currentShare}%`} />
      </div>

      <div className="border-t border-[var(--border)] pt-4">
        <div className="text-muted mb-3 text-[10px] uppercase tracking-wider">Projected Share by Milestone</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="border-border rounded border p-3 text-center">
            <div className="text-muted text-[10px]">Bronze</div>
            <div className="text-foreground text-sm font-bold">{Math.round(data.projected_share.bronze).toLocaleString()}</div>
            <div className="text-muted text-[10px]">PLOT</div>
          </div>
          <div className="border-border rounded border p-3 text-center">
            <div className="text-muted text-[10px]">Silver</div>
            <div className="text-foreground text-sm font-bold">{Math.round(data.projected_share.silver).toLocaleString()}</div>
            <div className="text-muted text-[10px]">PLOT</div>
          </div>
          <div className="border-border rounded border p-3 text-center">
            <div className="text-muted text-[10px]">Gold</div>
            <div className="text-foreground text-sm font-bold">{Math.round(data.projected_share.gold).toLocaleString()}</div>
            <div className="text-muted text-[10px]">PLOT</div>
          </div>
          <div className="border-border rounded border p-3 text-center">
            <div className="text-accent text-[10px]">Diamond</div>
            <div className="text-accent text-sm font-bold">{Math.round(data.projected_share.diamond).toLocaleString()}</div>
            <div className="text-muted text-[10px]">PLOT</div>
          </div>
        </div>
      </div>
    </div>
  );
}
