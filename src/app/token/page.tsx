"use client";

import { useAccount, useReadContract } from "wagmi";
import { formatUnits, erc20Abi } from "viem";
import { useState } from "react";
import {
  PLOT_TOKEN, EXPLORER_URL,
} from "../../../lib/contracts/constants";

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

  const { data: totalSupply, isLoading: supplyLoading } = useReadContract({
    address: PLOT_TOKEN,
    abi: erc20Abi,
    functionName: "totalSupply",
  });

  const formattedBalance = balance ? formatUnits(balance, 18) : "0";
  const formattedSupply = totalSupply ? formatUnits(totalSupply, 18) : "0";

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(PLOT_TOKEN);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
      {/* Page Title */}
      <div className="text-center mb-6">
        <h1 className="text-foreground text-2xl font-bold">$PLOT Token</h1>
        <p className="text-muted mt-1 text-sm">The reserve token behind every story on PlotLink</p>
      </div>

      {/* Your Balance */}
      <div className="bg-accent text-background rounded p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-background/60 text-xs uppercase tracking-wider">Your Balance</h2>
          {isConnected && (
            <div className="flex items-center gap-1.5 text-xs text-background/80">
              <div className="bg-background h-1.5 w-1.5 animate-pulse rounded-full" />
              Connected
            </div>
          )}
        </div>

        {!isConnected ? (
          <div className="text-center py-4">
            <p className="text-background/70 text-sm">Connect your wallet to view balance</p>
          </div>
        ) : balanceLoading ? (
          <div className="text-center py-4">
            <p className="text-background/70 text-sm">Loading...</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-background text-3xl font-bold">
              {parseFloat(formattedBalance).toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}{" "}
              <span className="text-background/80">PLOT</span>
            </div>
          </div>
        )}
      </div>

      {/* Token Utility */}
      <div className="border-border rounded border p-5">
        <h3 className="text-foreground text-sm font-bold mb-3">Why PLOT?</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="bg-accent/10 text-accent flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold">1</span>
            <p className="text-muted text-sm">
              <span className="text-foreground font-semibold">Reserve token for story tokens</span> — every storyline token on PlotLink is backed by PLOT via MCV2 bonding curves.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-accent/10 text-accent flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold">2</span>
            <p className="text-muted text-sm">
              <span className="text-foreground font-semibold">TVL growth</span> — as more story tokens are minted, more PLOT gets locked in bonding curve reserves, increasing total value locked across all storylines.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-accent/10 text-accent flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold">3</span>
            <p className="text-muted text-sm">
              <span className="text-foreground font-semibold">Creator royalties</span> — 1% mint and 1% burn royalty on every trade flows directly to the story writer.
            </p>
          </div>
        </div>
      </div>

      {/* How to Get PLOT */}
      <div className="border-border rounded border p-5">
        <h3 className="text-foreground text-sm font-bold mb-3">How to Get PLOT</h3>
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <span className="text-accent text-sm">&#8226;</span>
            <p className="text-muted text-sm">
              <span className="text-foreground font-semibold">Buy via Mint Club</span> — purchase PLOT on the bonding curve using HUNT tokens.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-accent text-sm">&#8226;</span>
            <p className="text-muted text-sm">
              <span className="text-foreground font-semibold">Sell story tokens</span> — selling any storyline token returns PLOT to your wallet.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-accent text-sm">&#8226;</span>
            <p className="text-muted text-sm">
              <span className="text-foreground font-semibold">Use the Zap</span> — buy story tokens with ETH, USDC, or HUNT and the zap contract handles PLOT conversion automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Token Information */}
      <div className="border-border rounded border p-5">
        <h3 className="text-foreground text-sm font-bold mb-3">Token Information</h3>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="border-border rounded border p-3">
            <div className="text-muted text-[10px] uppercase tracking-wider mb-1">Total Supply</div>
            {supplyLoading ? (
              <div className="bg-border h-6 animate-pulse rounded" />
            ) : (
              <div className="text-foreground text-sm font-bold">
                {parseFloat(formattedSupply).toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })} PLOT
              </div>
            )}
          </div>
          <div className="border-border rounded border p-3">
            <div className="text-muted text-[10px] uppercase tracking-wider mb-1">Network</div>
            <div className="text-foreground text-sm font-bold flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
              Base Mainnet
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="space-y-2">
          <a
            href={MINT_CLUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border hover:border-accent flex items-center justify-between rounded border p-3 transition-colors"
          >
            <span className="text-foreground text-sm">View on Mint Club</span>
            <span className="text-muted text-xs">&#8599;</span>
          </a>

          <a
            href={HUNT_TOWN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border hover:border-accent flex items-center justify-between rounded border p-3 transition-colors"
          >
            <span className="text-foreground text-sm">View on Hunt Town</span>
            <span className="text-muted text-xs">&#8599;</span>
          </a>

          <a
            href={BASESCAN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border hover:border-accent flex items-center justify-between rounded border p-3 transition-colors"
          >
            <div>
              <div className="text-muted text-[10px] uppercase tracking-wider">Contract Address</div>
              <code className="text-foreground text-sm font-bold">
                {PLOT_TOKEN.slice(0, 6)}...{PLOT_TOKEN.slice(-6)}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleCopyAddress();
                }}
                className="text-muted hover:text-foreground text-xs transition-colors"
                title="Copy address"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <span className="text-muted text-xs">&#8599;</span>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
