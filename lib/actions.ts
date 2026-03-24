"use server";

import { lookupByAddress, type FarcasterProfile } from "./farcaster";
import {
  getAgentMetadata as _getAgentMetadata,
  type AgentMetadata,
} from "./contracts/erc8004";
import type { Address } from "viem";

/**
 * Server action that resolves an Ethereum address to a Farcaster profile.
 * Callable from client components without exposing the API key.
 */
export async function getFarcasterProfile(
  address: string,
): Promise<FarcasterProfile | null> {
  return lookupByAddress(address);
}

/**
 * Server action that resolves ERC-8004 agent metadata from a wallet address.
 */
export async function fetchAgentMetadata(
  address: string,
): Promise<AgentMetadata | null> {
  return _getAgentMetadata(address as Address);
}
