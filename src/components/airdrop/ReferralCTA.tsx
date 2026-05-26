"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

export function ReferralCTA() {
  const { address, isConnected } = useAccount();
  const [fetchState, setFetchState] = useState<{ code: string | null; addr: string | null }>({ code: null, addr: null });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isConnected || !address) return;

    let cancelled = false;
    fetch(`/api/airdrop/referral-code?address=${address.toLowerCase()}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) setFetchState({ code: d?.code ?? null, addr: address.toLowerCase() }); })
      .catch(() => { if (!cancelled) setFetchState({ code: null, addr: address.toLowerCase() }); });
    return () => { cancelled = true; };
  }, [isConnected, address]);

  const code = fetchState.addr === address?.toLowerCase() ? fetchState.code : null;

  if (!code) {
    return (
      <div className="border-border rounded border p-4">
        <h3 className="text-accent mb-1 text-xs font-bold uppercase tracking-wider">Invite Friends</h3>
        <p className="text-muted text-xs">Your referral link will appear once activation is complete.</p>
      </div>
    );
  }

  const refUrl = `https://plotlink.xyz/?ref=${code}`;
  const shareText = `Join the PlotLink Buy-Back Sprint! Use my referral link to boost both our multipliers:`;
  const xShareUrl = `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(refUrl)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(refUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = refUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border-border rounded border p-4 space-y-3">
      <h3 className="text-accent text-xs font-bold uppercase tracking-wider">Invite Friends</h3>

      <div className="bg-[var(--surface)] flex items-center gap-2 rounded px-3 py-2">
        <span className="text-foreground flex-1 truncate text-xs">{refUrl}</span>
        <button
          onClick={handleCopy}
          className="text-accent shrink-0 text-xs font-medium hover:opacity-80 transition-opacity"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <a
        href={xShareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-accent text-background inline-flex items-center gap-1.5 rounded px-4 py-2 text-xs font-medium transition-opacity hover:opacity-80"
      >
        Share on X
      </a>

      <p className="text-muted text-[10px]">
        Each qualified referral adds +0.2 to your multiplier (up to 3.0×).
      </p>
    </div>
  );
}
