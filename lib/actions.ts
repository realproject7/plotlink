"use server";

import { lookupByAddress, type FarcasterProfile } from "./farcaster";
import {
  getAgentMetadata as _getAgentMetadata,
  type AgentMetadata,
} from "./contracts/erc8004";
import { createServiceRoleClient, type User } from "./supabase";
import type { Address } from "viem";

/**
 * Server action that resolves an Ethereum address to a Farcaster profile.
 * Prefers cached DB data, falls back to live API.
 */
export async function getFarcasterProfile(
  address: string,
): Promise<FarcasterProfile | null> {
  // Try DB first (only if user has a FID — wallet-only users have no Farcaster profile)
  const dbUser = await getUserFromDB(address);
  if (dbUser && dbUser.fid != null) {
    return {
      fid: dbUser.fid,
      username: dbUser.username ?? "",
      displayName: dbUser.display_name ?? dbUser.username ?? "",
      pfpUrl: dbUser.pfp_url ?? null,
      bio: dbUser.bio ?? null,
    };
  }
  // Fallback to live API
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

/**
 * Look up a user from the DB by wallet address.
 * Searches verified_addresses first, then primary_address for wallet-only users.
 */
export async function getUserFromDB(
  address: string,
): Promise<User | null> {
  const supabase = createServiceRoleClient();
  if (!supabase) return null;

  const normalized = address.toLowerCase();

  const { data: byVerified } = await supabase
    .from("users")
    .select("*")
    .contains("verified_addresses", [normalized])
    .single();

  if (byVerified) return byVerified;

  const { data: byPrimary } = await supabase
    .from("users")
    .select("*")
    .eq("primary_address", normalized)
    .single();

  return byPrimary ?? null;
}
