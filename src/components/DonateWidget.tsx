"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { publicClient } from "../../lib/rpc";
import { erc20Abi } from "../../lib/price";
import { storyFactoryAbi } from "../../lib/contracts/abi";
import { STORY_FACTORY, PLOT_TOKEN, IS_TESTNET } from "../../lib/contracts/constants";

type TxState = "idle" | "approving" | "confirming" | "pending" | "indexing" | "done" | "error";

interface DonateWidgetProps {
  storylineId: number;
}

export function DonateWidget({ storylineId }: DonateWidgetProps) {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [txState, setTxState] = useState<TxState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();

  const reserveLabel = IS_TESTNET ? "WETH" : "$PLOT";
  const parsedAmount =
    amount && !isNaN(Number(amount)) && Number(amount) > 0
      ? parseUnits(amount, 18)
      : BigInt(0);

  const executeDonate = useCallback(async () => {
    if (!address || parsedAmount === BigInt(0)) return;

    try {
      setError(null);
      setTxHash(null);

      // Check allowance for PLOT_TOKEN → StoryFactory
      const allowance = await publicClient.readContract({
        address: PLOT_TOKEN,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, STORY_FACTORY],
      });

      if (allowance < parsedAmount) {
        setTxState("approving");
        const approveHash = await writeContractAsync({
          address: PLOT_TOKEN,
          abi: erc20Abi,
          functionName: "approve",
          args: [STORY_FACTORY, parsedAmount],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // Call donate()
      setTxState("confirming");
      const hash = await writeContractAsync({
        address: STORY_FACTORY,
        abi: storyFactoryAbi,
        functionName: "donate",
        args: [BigInt(storylineId), parsedAmount],
        gas: BigInt(150_000),
      });
      setTxHash(hash);

      setTxState("pending");
      await publicClient.waitForTransactionReceipt({ hash });

      // Trigger donation indexer
      setTxState("indexing");
      const indexRes = await fetch("/api/index/donation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: hash }),
      });
      if (!indexRes.ok) {
        throw new Error("Donation sent on-chain but indexing failed. It will appear after the next backfill.");
      }

      setTxState("done");
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxState("error");
    }
  }, [address, parsedAmount, storylineId, writeContractAsync]);

  const reset = useCallback(() => {
    setTxState("idle");
    setError(null);
    setTxHash(null);
  }, []);

  if (!isConnected) return null;

  return (
    <section className="border-border mt-8 rounded border px-4 py-4">
      <h2 className="text-foreground text-sm font-medium">Donate to Writer</h2>
      <p className="text-muted mt-1 text-[10px]">
        Tip the author directly with {reserveLabel}
      </p>

      <div className="mt-3">
        <label className="text-muted block text-[10px] uppercase tracking-wider">
          Amount ({reserveLabel})
        </label>
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
          className="border-border bg-background text-foreground mt-1 w-full rounded border px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
        />
      </div>

      {parsedAmount > BigInt(0) && (
        <p className="text-muted mt-2 text-xs">
          Donating{" "}
          <span className="text-foreground">
            {formatUnits(parsedAmount, 18)} {reserveLabel}
          </span>{" "}
          to story #{storylineId}
        </p>
      )}

      <button
        onClick={txState === "done" || txState === "error" ? reset : executeDonate}
        disabled={
          (txState === "idle" && parsedAmount === BigInt(0)) ||
          (txState !== "idle" && txState !== "done" && txState !== "error")
        }
        className="bg-accent text-background mt-3 w-full rounded py-2 text-xs font-medium transition-opacity disabled:opacity-40"
      >
        {txState === "idle" && "Donate"}
        {txState === "approving" && "Approving..."}
        {txState === "confirming" && "Confirm in wallet..."}
        {txState === "pending" && "Pending..."}
        {txState === "indexing" && "Indexing..."}
        {txState === "done" && "Done — Donate again"}
        {txState === "error" && "Retry"}
      </button>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {txHash && txState === "done" && (
        <p className="text-muted mt-2 text-xs">
          Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
        </p>
      )}
    </section>
  );
}
