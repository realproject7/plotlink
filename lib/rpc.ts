import { createPublicClient, http, fallback, type Hex } from "viem";
import { base, baseSepolia } from "viem/chains";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "84532");
const chain = chainId === 8453 ? base : baseSepolia;

const customRpc = process.env.NEXT_PUBLIC_RPC_URL;

const transport = customRpc
  ? fallback([http(customRpc), http()])
  : http();

/**
 * Shared public client for reading from Base (or Base Sepolia).
 *
 * Chain is selected via NEXT_PUBLIC_CHAIN_ID (default: 84532 / Base Sepolia).
 * Uses NEXT_PUBLIC_RPC_URL with a fallback to the chain's default public RPC.
 */
export const publicClient = createPublicClient({
  chain,
  transport,
});

/**
 * Fetch a transaction receipt with retries and backoff.
 * Load-balanced RPC nodes may not have the receipt immediately after
 * `waitForTransactionReceipt` completes on the client side.
 */
export async function getReceiptWithRetry(hash: Hex, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await publicClient.getTransactionReceipt({ hash });
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  throw new Error("unreachable");
}
