"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { parseUnits, formatUnits, type Address } from "viem";
import { browserClient as publicClient } from "../../lib/rpc";
import { mcv2BondAbi, erc20Abi } from "../../lib/price";
import { MCV2_BOND, PLOT_TOKEN, RESERVE_LABEL, EXPLORER_URL } from "../../lib/contracts/constants";

type Tab = "buy" | "sell";
type TxState = "idle" | "approving" | "confirming" | "pending" | "done" | "error";

const SLIPPAGE_BPS = 300; // 3% slippage tolerance

function applySlippage(amount: bigint, isBuy: boolean): bigint {
  if (isBuy) {
    // Max cost = estimate * (1 + slippage)
    return amount + (amount * BigInt(SLIPPAGE_BPS)) / BigInt(10000);
  }
  // Min refund = estimate * (1 - slippage)
  return amount - (amount * BigInt(SLIPPAGE_BPS)) / BigInt(10000);
}

export function TradingWidget({ tokenAddress }: { tokenAddress: Address }) {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("buy");
  const [amount, setAmount] = useState("");
  const [txState, setTxState] = useState<TxState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();

  const parsedAmount =
    amount && !isNaN(Number(amount)) && Number(amount) > 0
      ? parseUnits(amount, 18)
      : BigInt(0);

  // Fetch relevant balance: reserve token for buy, storyline token for sell
  const balanceToken = tab === "buy" ? PLOT_TOKEN : tokenAddress;
  const { data: balance, refetch: refetchBalance } = useQuery({
    queryKey: ["token-balance", balanceToken, address],
    queryFn: async () => {
      return publicClient.readContract({
        address: balanceToken,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address!],
      });
    },
    enabled: !!address,
    refetchInterval: 15000,
  });

  // Fetch price estimate
  const { data: estimate } = useQuery({
    queryKey: ["trade-estimate", tab, tokenAddress, amount],
    queryFn: async () => {
      if (parsedAmount === BigInt(0)) return null;
      const result = await publicClient.readContract({
        address: MCV2_BOND,
        abi: mcv2BondAbi,
        functionName: tab === "buy" ? "getReserveForToken" : "getRefundForTokens",
        args: [tokenAddress, parsedAmount],
      });
      // ABI returns [amount, royalty] tuple — extract the amount
      return (result as readonly [bigint, bigint])[0];
    },
    enabled: parsedAmount > BigInt(0),
    refetchInterval: 15000,
  });

  const executeTrade = useCallback(async () => {
    if (!address || parsedAmount === BigInt(0) || !estimate) return;

    try {
      setError(null);
      setTxHash(null);
      let tradeHash: string | null = null;

      if (tab === "buy") {
        // Buy: approve PLOT_TOKEN → mint
        const maxCost = applySlippage(estimate, true);

        // Check allowance
        const allowance = await publicClient.readContract({
          address: PLOT_TOKEN,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, MCV2_BOND],
        });

        if (allowance < maxCost) {
          setTxState("approving");
          const approveHash = await writeContractAsync({
            address: PLOT_TOKEN,
            abi: erc20Abi,
            functionName: "approve",
            args: [MCV2_BOND, maxCost],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }

        // Mint
        setTxState("confirming");
        const hash = await writeContractAsync({
          address: MCV2_BOND,
          abi: mcv2BondAbi,
          functionName: "mint",
          args: [tokenAddress, parsedAmount, maxCost, address],
          gas: BigInt(2_000_000),
        });
        setTxHash(hash);
        tradeHash = hash;
        setTxState("pending");
        await publicClient.waitForTransactionReceipt({ hash });
      } else {
        // Sell: approve storyline token → burn → receive PLOT_TOKEN
        const minRefund = applySlippage(estimate, false);

        // Check allowance for storyline token
        const allowance = await publicClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, MCV2_BOND],
        });

        if (allowance < parsedAmount) {
          setTxState("approving");
          const approveHash = await writeContractAsync({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "approve",
            args: [MCV2_BOND, parsedAmount],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }

        setTxState("confirming");
        const hash = await writeContractAsync({
          address: MCV2_BOND,
          abi: mcv2BondAbi,
          functionName: "burn",
          args: [tokenAddress, parsedAmount, minRefund, address],
          gas: BigInt(2_000_000),
        });
        setTxHash(hash);
        tradeHash = hash;
        setTxState("pending");
        await publicClient.waitForTransactionReceipt({ hash });
      }

      setTxState("done");
      setAmount("");
      refetchBalance();

      // Index the trade for price history (fire-and-forget)
      if (tradeHash) {
        fetch("/api/index/trade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash: tradeHash, tokenAddress }),
        }).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxState("error");
    }
  }, [address, parsedAmount, estimate, tab, tokenAddress, writeContractAsync, refetchBalance]);

  const reset = useCallback(() => {
    setTxState("idle");
    setError(null);
    setTxHash(null);
  }, []);

  // Pre-validate balance
  const insufficientBalance =
    balance !== undefined &&
    parsedAmount > BigInt(0) &&
    (tab === "buy"
      ? estimate != null && applySlippage(estimate, true) > balance
      : parsedAmount > balance);

  if (!isConnected) return null;

  return (
    <section className="border-border mt-8 rounded border px-4 py-4">
      <h2 className="text-foreground text-sm font-medium">Trade</h2>

      {/* Tabs */}
      <div className="mt-3 flex gap-2">
        {(["buy", "sell"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setAmount("");
              reset();
            }}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              tab === t
                ? "bg-accent text-background"
                : "border-border text-muted hover:text-foreground border"
            }`}
          >
            {t === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="mt-3">
        <label className="text-muted block text-[10px] uppercase tracking-wider">
          {tab === "buy" ? "Tokens to buy" : "Tokens to sell"}
        </label>
        <div className="relative mt-1">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (txState !== "idle") reset();
            }}
            disabled={txState !== "idle" && txState !== "error" && txState !== "done"}
            className={`border-border bg-background text-foreground w-full rounded border px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50 ${tab === "sell" ? "pr-14" : ""}`}
          />
          {tab === "sell" && balance !== undefined && (
            <button
              type="button"
              onClick={() => setAmount(formatUnits(balance, 18))}
              className="text-accent hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold"
            >
              MAX
            </button>
          )}
        </div>
        {balance !== undefined && (
          <p className="text-muted mt-1 text-[10px]">
            Balance: {formatUnits(balance, 18)} {tab === "buy" ? RESERVE_LABEL : "tokens"}
          </p>
        )}
        {insufficientBalance && (
          <p className="mt-1 text-[10px] text-red-400">Insufficient balance</p>
        )}
      </div>

      {/* Estimate */}
      {estimate != null && parsedAmount > BigInt(0) && (
        <div className="text-muted mt-2 text-xs">
          {tab === "buy" ? "Estimated cost" : "Estimated return"}:{" "}
          <span className="text-foreground">
            {formatUnits(estimate, 18)} {RESERVE_LABEL}
          </span>
          <span className="ml-2">(3% slippage tolerance)</span>
        </div>
      )}

      {/* Action button */}
      <button
        onClick={txState === "done" || txState === "error" ? reset : executeTrade}
        disabled={
          (txState === "idle" && (parsedAmount === BigInt(0) || !estimate || insufficientBalance)) ||
          (txState !== "idle" && txState !== "done" && txState !== "error")
        }
        className="bg-accent text-background mt-3 w-full rounded py-2 text-xs font-medium transition-opacity disabled:opacity-40"
      >
        {txState === "idle" && (tab === "buy" ? "Buy Tokens" : "Sell Tokens")}
        {txState === "approving" && "Approving..."}
        {txState === "confirming" && "Confirm in wallet..."}
        {txState === "pending" && "Pending..."}
        {txState === "done" && "Done — Trade again"}
        {txState === "error" && "Retry"}
      </button>

      {/* Status */}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {txHash && txState === "done" && (
        <p className="text-muted mt-2 text-xs">
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
    </section>
  );
}
