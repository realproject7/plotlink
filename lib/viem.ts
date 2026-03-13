import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

/**
 * Public client for reading from Base.
 *
 * Uses the default Base RPC. Override via NEXT_PUBLIC_BASE_RPC_URL env var.
 */
export const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || undefined),
});
