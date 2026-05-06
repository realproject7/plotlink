"use client";

import { useState } from "react";
import { usePlatformDetection } from "../../hooks/usePlatformDetection";
import { PLOT_TOKEN } from "../../../lib/contracts/constants";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const UNISWAP_URL = `https://app.uniswap.org/swap?outputCurrency=${PLOT_TOKEN}&chain=base`;

export function SwapInterface() {
  const { platform, isLoading } = usePlatformDetection();
  const [swapLoading, setSwapLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNativeSwap = async () => {
    try {
      setSwapLoading(true);
      setError(null);

      const { sdk } = await import("@farcaster/miniapp-sdk");
      const result = await sdk.actions.swapToken({
        sellToken: `eip155:8453/erc20:${USDC_ADDRESS}`,
        buyToken: `eip155:8453/erc20:${PLOT_TOKEN}`,
      });

      if (!result.success) {
        if (result.reason === "rejected_by_user") {
          setError("Swap cancelled by user");
        } else {
          setError("Swap failed. Please try again.");
        }
      }
    } catch {
      setError("Failed to open swap interface");
    } finally {
      setSwapLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-surface rounded-[var(--card-radius)] border border-border p-5">
        <div className="flex items-center justify-center py-6">
          <div className="bg-border h-8 w-32 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (platform === "farcaster") {
    return (
      <div className="bg-surface rounded-[var(--card-radius)] border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-foreground text-sm font-semibold">Swap to $PLOT</h3>
          <span className="bg-accent-bg text-accent rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            Farcaster
          </span>
        </div>

        {error && (
          <div className="border-danger/30 bg-danger/5 text-danger rounded-[var(--card-radius)] border p-3 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleNativeSwap}
          disabled={swapLoading}
          className="bg-accent text-white hover:bg-accent-dim disabled:opacity-50 flex w-full items-center justify-center gap-2 rounded-[var(--card-radius)] px-4 py-3 text-sm font-semibold transition-colors"
        >
          {swapLoading ? (
            <span>Opening Swap...</span>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" />
              </svg>
              <span>Swap to PLOT</span>
            </>
          )}
        </button>

        <p className="text-muted text-center text-[11px]">
          Opens Farcaster&apos;s native swap interface
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-[var(--card-radius)] border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground text-sm font-semibold">Swap to $PLOT</h3>
        <span className="bg-accent-bg text-accent rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
          Web
        </span>
      </div>

      <a
        href={UNISWAP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-accent text-white hover:bg-accent-dim flex w-full items-center justify-center gap-2 rounded-[var(--card-radius)] px-4 py-3 text-sm font-semibold transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" />
        </svg>
        <span>Buy PLOT on Uniswap</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>

      <p className="text-muted text-center text-[11px]">
        Opens Uniswap in a new tab
      </p>
    </div>
  );
}
