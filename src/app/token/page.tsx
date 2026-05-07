"use client";

import { useAccount, useReadContract } from "wagmi";
import { formatUnits, erc20Abi } from "viem";
import { useState } from "react";
import Image from "next/image";
import {
  PLOT_TOKEN, EXPLORER_URL,
} from "../../../lib/contracts/constants";
import { SwapInterface } from "../../components/token/SwapInterface";
import { useTokenInfo, formatPrice, formatNumber } from "../../hooks/useTokenInfo";

const BASESCAN_URL = `${EXPLORER_URL}/token/${PLOT_TOKEN}`;
const MINT_CLUB_URL = "https://mint.club/token/base/PLOT";
const HUNT_TOWN_URL = "https://hunt.town/project/PLOT";

export default function TokenPage() {
  const { address, isConnected } = useAccount();
  const [copied, setCopied] = useState(false);

  const { data: balance, isLoading: balanceLoading } = useReadContract({
    address: PLOT_TOKEN,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: tokenInfo, isLoading: tokenInfoLoading } = useTokenInfo();

  const formattedBalance = balance ? formatUnits(balance, 18) : "0";

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(PLOT_TOKEN);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="mx-auto max-w-[512px] px-5 py-8 sm:py-12 space-y-5">
      {/* Hero */}
      <header className="text-center py-6">
        <h1 className="font-heading text-[36px] font-semibold tracking-tight text-foreground leading-[1.15]">
          <span className="text-accent">$PLOT</span>
        </h1>
        <p className="text-muted mt-1.5 text-[15px] max-w-[360px] mx-auto">
          The reserve token behind every story on PlotLink
        </p>
      </header>

      {/* Price + Stats */}
      <div className="grid grid-cols-2 gap-[var(--card-gap)]">
        <div className="bg-surface rounded-[var(--card-radius)] border border-border p-4">
          <div className="text-muted text-[10px] uppercase tracking-wider mb-1">Price</div>
          {tokenInfoLoading ? (
            <div className="bg-border h-6 animate-pulse rounded" />
          ) : tokenInfo ? (
            <div className="space-y-0.5">
              <div className="text-foreground text-lg font-bold sm:text-xl">
                {formatPrice(tokenInfo.price)}
              </div>
              {tokenInfo.priceChange24h !== null && (
                <div className={`text-xs ${tokenInfo.priceChange24h >= 0 ? "text-success" : "text-danger"}`}>
                  {tokenInfo.priceChange24h >= 0 ? "+" : ""}
                  {tokenInfo.priceChange24h.toFixed(2)}%
                </div>
              )}
            </div>
          ) : (
            <div className="text-muted text-sm">—</div>
          )}
        </div>
        <div className="bg-surface rounded-[var(--card-radius)] border border-border p-4">
          <div className="text-muted text-[10px] uppercase tracking-wider mb-1">FDV</div>
          {tokenInfoLoading ? (
            <div className="bg-border h-6 animate-pulse rounded" />
          ) : tokenInfo ? (
            <div className="text-foreground text-lg font-bold sm:text-xl">
              ${formatNumber(tokenInfo.fdv)}
            </div>
          ) : (
            <div className="text-muted text-sm">—</div>
          )}
        </div>
      </div>

      {/* Balance */}
      <div className="relative overflow-hidden rounded-md border border-accent/20 p-7 text-center" style={{ background: "linear-gradient(135deg, oklch(28% 0.06 28) 0%, oklch(20% 0.05 40) 100%)" }}>
        <div className="pointer-events-none absolute -top-[40%] -right-[20%] h-[200px] w-[200px] rounded-full" style={{ background: "radial-gradient(circle, oklch(52% 0.14 28 / 0.08) 0%, transparent 70%)" }} />
        <div className="relative flex items-center justify-center gap-2 mb-4">
          <h2 className="text-xs font-medium uppercase tracking-[0.04em] text-white/60">Your Balance</h2>
          {isConnected && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-success">
              <div className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_6px_oklch(45%_0.14_145_/_0.5)]" />
              Connected
            </div>
          )}
        </div>

        {!isConnected ? (
          <div className="relative text-center py-2">
            <p className="text-white/50 text-[13px] mb-3.5">Connect your wallet to view balance</p>
          </div>
        ) : balanceLoading ? (
          <div className="relative text-center py-2">
            <div className="bg-white/10 h-8 w-32 mx-auto animate-pulse rounded" />
          </div>
        ) : (
          <div className="relative text-center">
            <div className="font-mono text-[38px] font-bold tabular-nums leading-[1.1] tracking-tight text-white">
              {parseFloat(formattedBalance).toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
              <span className="ml-1.5 text-lg font-medium tracking-wide text-white/50">PLOT</span>
            </div>
            {tokenInfo?.price && parseFloat(formattedBalance) > 0 && (
              <div className="font-mono text-[15px] tabular-nums text-white/40 mt-1.5">
                ${(parseFloat(formattedBalance) * tokenInfo.price).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} USD
              </div>
            )}
          </div>
        )}
      </div>

      {/* Swap */}
      <SwapInterface />

      {/* Token Utility */}
      <div className="bg-surface rounded-md border border-border p-6">
        <h3 className="font-heading text-xl font-semibold text-foreground mb-5">Why $PLOT?</h3>
        <div className="space-y-5">
          <div className="grid grid-cols-[36px_1fr] items-start gap-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/20 bg-accent-bg font-mono text-sm font-bold text-accent">1</span>
            <div>
              <div className="text-sm font-semibold text-foreground mb-1">Reserve token for story tokens</div>
              <p className="text-[13px] leading-relaxed text-muted">Every storyline token on PlotLink is backed by PLOT via MCV2 bonding curves.</p>
            </div>
          </div>
          <div className="grid grid-cols-[36px_1fr] items-start gap-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/20 bg-accent-bg font-mono text-sm font-bold text-accent">2</span>
            <div>
              <div className="text-sm font-semibold text-foreground mb-1">TVL growth</div>
              <p className="text-[13px] leading-relaxed text-muted">As more story tokens are minted, more PLOT gets locked in bonding curve reserves.</p>
            </div>
          </div>
          <div className="grid grid-cols-[36px_1fr] items-start gap-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/20 bg-accent-bg font-mono text-sm font-bold text-accent">3</span>
            <div>
              <div className="text-sm font-semibold text-foreground mb-1">Creator royalties</div>
              <p className="text-[13px] leading-relaxed text-muted">1% mint and 1% burn royalty on every trade flows directly to the story writer.</p>
            </div>
          </div>
        </div>
      </div>

      {/* External Links */}
      <div className="space-y-[var(--card-gap)]">
        <a
          href={MINT_CLUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-surface border border-border hover:border-accent/50 flex items-center justify-between rounded-[var(--card-radius)] p-3 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Image src="/mc-icon-light.svg" alt="Mint Club" width={20} height={20} className="h-5 w-5" />
            <span className="text-foreground text-sm">View on Mint Club</span>
          </div>
          <ExternalLinkIcon />
        </a>

        <a
          href={HUNT_TOWN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-surface border border-border hover:border-accent/50 flex items-center justify-between rounded-[var(--card-radius)] p-3 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Image src="/hunt-token.svg" alt="Hunt Town" width={20} height={20} className="h-5 w-5" />
            <span className="text-foreground text-sm">View on Hunt Town</span>
          </div>
          <ExternalLinkIcon />
        </a>

        <a
          href={BASESCAN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-surface border border-border hover:border-accent/50 flex items-center justify-between rounded-[var(--card-radius)] p-3 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Image src="/basescan-icon.svg" alt="Basescan" width={20} height={20} className="h-5 w-5" />
            <div className="flex flex-col">
              <span className="text-muted text-[10px] uppercase tracking-wider">Contract</span>
              <code className="text-foreground text-sm font-mono">
                {PLOT_TOKEN.slice(0, 6)}...{PLOT_TOKEN.slice(-6)}
              </code>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.preventDefault(); handleCopyAddress(); }}
              className="text-muted hover:text-foreground p-1 transition-colors"
              title="Copy address"
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              )}
            </button>
            <ExternalLinkIcon />
          </div>
        </a>
      </div>

      {/* Network Badge */}
      <div className="bg-surface border border-border rounded-[var(--card-radius)] flex items-center gap-3 p-3">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
        </div>
        <span className="text-foreground text-sm">Base Mainnet (ERC-20)</span>
      </div>
    </div>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
