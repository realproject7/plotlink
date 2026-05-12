"use client";

import { useState, useCallback } from "react";
import { useAccount, useBalance, useWriteContract } from "wagmi";
import { parseEther, formatEther } from "viem";
import { browserClient as publicClient } from "../../../lib/rpc";
import { usePlatformDetection } from "../../hooks/usePlatformDetection";
import { PLOT_TOKEN, EXPLORER_URL } from "../../../lib/contracts/constants";
import { getSwapQuote, buildSwapTx, type SwapQuote } from "../../../lib/swap";
import { formatTokenAmount } from "../../../lib/format";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const UNISWAP_URL = `https://app.uniswap.org/swap?outputCurrency=${PLOT_TOKEN}&chain=base`;

const ETH_GAS_BUFFER = BigInt("1000000000000000");

type TxState = "idle" | "quoting" | "confirming" | "pending" | "done" | "error";

export function SwapInterface() {
  const { platform, isLoading } = usePlatformDetection();
  const { address, isConnected } = useAccount();
  const { data: ethBalance } = useBalance({ address });
  const { writeContractAsync } = useWriteContract();

  const [swapLoading, setSwapLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);

  const parsedAmount =
    amount && !isNaN(Number(amount)) && Number(amount) > 0
      ? parseEther(amount)
      : BigInt(0);

  const insufficientBalance =
    ethBalance !== undefined && parsedAmount > BigInt(0) && parsedAmount > ethBalance.value;

  const handleGetQuote = useCallback(async () => {
    if (parsedAmount <= BigInt(0)) return;
    try {
      setError(null);
      setTxState("quoting");
      const q = await getSwapQuote(parsedAmount);
      setQuote(q);
      setTxState("idle");
    } catch {
      setError("Failed to get quote. Pool may not be available.");
      setTxState("error");
    }
  }, [parsedAmount]);

  const handleSwap = useCallback(async () => {
    if (!quote || !address) return;
    try {
      setError(null);
      setTxState("confirming");
      const tx = buildSwapTx(quote, address);
      const hash = await writeContractAsync(tx);
      setTxHash(hash);
      setTxState("pending");
      await publicClient.waitForTransactionReceipt({ hash });
      setTxState("done");
      setAmount("");
      setQuote(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Swap failed");
      setTxState("error");
    }
  }, [quote, address, writeContractAsync]);

  const reset = useCallback(() => {
    setTxState("idle");
    setError(null);
    setTxHash(null);
    setQuote(null);
  }, []);

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
              <SwapIcon />
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

  // Base App: in-app swap with connected wallet
  if (platform === "base" && isConnected) {
    return (
      <div className="bg-surface rounded-[var(--card-radius)] border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-foreground text-sm font-semibold">Swap to $PLOT</h3>
          <span className="bg-accent-bg text-accent rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            Base
          </span>
        </div>

        {error && (
          <div className="border-danger/30 bg-danger/5 text-danger rounded-[var(--card-radius)] border p-3 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="text-muted block text-[10px] uppercase tracking-wider">
            Amount (ETH)
          </label>
          <div className="relative mt-1">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setQuote(null);
                if (txState !== "idle") reset();
              }}
              disabled={txState !== "idle" && txState !== "error" && txState !== "done"}
              className="border-border bg-surface text-foreground w-full rounded border px-3 py-2 pr-14 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
            />
            {ethBalance && (
              <button
                type="button"
                onClick={() => {
                  const max = ethBalance.value > ETH_GAS_BUFFER ? ethBalance.value - ETH_GAS_BUFFER : BigInt(0);
                  setAmount(formatEther(max));
                  setQuote(null);
                }}
                className="text-accent hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold"
              >
                MAX
              </button>
            )}
          </div>
          {ethBalance && (
            <p className="text-muted mt-1 text-[10px]">
              Balance: {formatTokenAmount(ethBalance.value, 18)} ETH
            </p>
          )}
          {insufficientBalance && (
            <p className="mt-1 text-[10px] text-error">Insufficient balance</p>
          )}
        </div>

        {quote && (
          <div className="text-muted text-xs">
            Est. output:{" "}
            <span className="font-semibold text-accent">
              {formatTokenAmount(quote.amountOut, 18)} PLOT
            </span>
            <span className="ml-2">(min: {formatTokenAmount(quote.amountOutMin, 18)})</span>
          </div>
        )}

        {txHash && txState === "done" && (
          <p className="text-muted text-xs">
            Tx:{" "}
            <a
              href={`${EXPLORER_URL}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </a>
          </p>
        )}

        {!quote ? (
          <button
            onClick={handleGetQuote}
            disabled={parsedAmount <= BigInt(0) || insufficientBalance || txState === "quoting"}
            className="bg-accent text-white hover:bg-accent-dim disabled:opacity-50 flex w-full items-center justify-center gap-2 rounded-[var(--card-radius)] px-4 py-3 text-sm font-semibold transition-colors"
          >
            {txState === "quoting" ? "Getting quote..." : "Get Quote"}
          </button>
        ) : (
          <button
            onClick={txState === "done" || txState === "error" ? reset : handleSwap}
            disabled={txState !== "idle" && txState !== "done" && txState !== "error"}
            className="bg-accent text-white hover:bg-accent-dim disabled:opacity-50 flex w-full items-center justify-center gap-2 rounded-[var(--card-radius)] px-4 py-3 text-sm font-semibold transition-colors"
          >
            {txState === "idle" && (
              <>
                <SwapIcon />
                <span>Swap to PLOT</span>
              </>
            )}
            {txState === "confirming" && "Confirm in wallet..."}
            {txState === "pending" && "Pending..."}
            {txState === "done" && "Done — Swap again"}
            {txState === "error" && "Retry"}
          </button>
        )}

        <p className="text-muted text-center text-[11px]">
          Swaps ETH → PLOT via your connected wallet
        </p>
      </div>
    );
  }

  // Web: external Uniswap link
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
        <SwapIcon />
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

function SwapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" />
    </svg>
  );
}
