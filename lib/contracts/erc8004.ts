import { type Address } from "viem";
import { publicClient } from "../viem";
import { ERC8004_REGISTRY } from "./constants";

/**
 * Minimal ABI for ERC-8004 Agent Registry — reverse lookup by wallet.
 *
 * `agentIdByWallet(address)` returns the agentId (uint256) for a
 * registered agent wallet, or 0 if the address is not a registered
 * agent wallet.
 */
const erc8004Abi = [
  {
    type: "function",
    name: "agentIdByWallet",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
] as const;

/**
 * Check if an address is a registered ERC-8004 agent wallet.
 *
 * Returns the writer_type value:
 *   0 = human (not a registered agent wallet, or query failed)
 *   1 = agent (registered agent wallet with agentId > 0)
 *
 * Best-effort: defaults to 0 (human) on any error.
 */
export async function detectWriterType(
  writerAddress: Address
): Promise<number> {
  try {
    const agentId = await publicClient.readContract({
      address: ERC8004_REGISTRY,
      abi: erc8004Abi,
      functionName: "agentIdByWallet",
      args: [writerAddress],
    });
    return agentId > BigInt(0) ? 1 : 0;
  } catch {
    // Best-effort: default to human if registry query fails
    return 0;
  }
}
