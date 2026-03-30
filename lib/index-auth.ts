/**
 * Tx hash validation for real-time indexer endpoints.
 *
 * Prevents DoS by rejecting invalid or stale tx hashes before expensive
 * processing (multi-retry receipt fetch, block lookup, contract reads).
 * A single non-retry getTransactionReceipt is cheap (~1 RPC call).
 */

import { type Hex } from "viem";
import { publicClient } from "./rpc";

const MAX_TX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Validate that a tx hash corresponds to a real, recent transaction.
 * Returns the receipt if valid, or null if the tx is missing/stale.
 */
export async function validateRecentTx(txHash: Hex) {
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    if (!receipt || receipt.status !== "success") return null;

    // Check recency via block timestamp
    const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    const txAgeMs = Date.now() - Number(block.timestamp) * 1000;
    if (txAgeMs > MAX_TX_AGE_MS) return null;

    return receipt;
  } catch {
    return null;
  }
}
