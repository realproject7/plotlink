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
 * Checks DB cache first, falls back to RPC. Caches externally registered agents.
 */
export async function fetchAgentMetadata(
  address: string,
): Promise<AgentMetadata | null> {
  // DB-first: check cached agent data (agent-specific lookup)
  const dbUser = await getAgentUserFromDB(address);
  if (dbUser?.agent_id != null) {
    return {
      agentId: String(dbUser.agent_id),
      owner: dbUser.agent_owner ?? undefined,
      name: dbUser.agent_name ?? "Unknown Agent",
      description: dbUser.agent_description ?? "",
      genre: dbUser.agent_genre ?? undefined,
      llmModel: dbUser.agent_llm_model ?? undefined,
      registeredAt: dbUser.agent_registered_at ?? undefined,
    };
  }

  // RPC fallback — also cache the result for next time
  const meta = await _getAgentMetadata(address as Address);
  if (meta && meta.agentId) {
    const supabase = createServiceRoleClient();
    if (supabase) {
      const normalized = address.toLowerCase();
      const userId = dbUser?.id;
      const agentFields = {
        agent_id: Number(meta.agentId),
        agent_name: meta.name || null,
        agent_description: meta.description || null,
        agent_genre: meta.genre || null,
        agent_llm_model: meta.llmModel || null,
        agent_owner: meta.owner?.toLowerCase() || null,
        agent_registered_at: meta.registeredAt || null,
        agent_wallet: normalized,
      };
      try {
        if (userId) {
          await supabase.from("users").update(agentFields).eq("id", userId);
        } else {
          await supabase.from("users").insert({ primary_address: normalized, ...agentFields });
        }
      } catch {
        // Best-effort cache — don't fail the metadata lookup
      }
    }
  }
  return meta;
}

/**
 * Look up a user from the DB by wallet address.
 * Searches verified_addresses first, then primary_address, then agent columns.
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

  if (byPrimary) return byPrimary;

  // Also check agent_wallet and agent_owner for externally registered agents
  const { data: byAgentWallet } = await supabase
    .from("users")
    .select("*")
    .eq("agent_wallet", normalized)
    .single();

  if (byAgentWallet) return byAgentWallet;

  const { data: byAgentOwner } = await supabase
    .from("users")
    .select("*")
    .eq("agent_owner", normalized)
    .single();

  return byAgentOwner ?? null;
}

/**
 * Look up an agent user from the DB, prioritizing rows with agent_id.
 * Use this for agent-specific lookups (detection, management, metadata).
 */
export async function getAgentUserFromDB(
  address: string,
): Promise<User | null> {
  const supabase = createServiceRoleClient();
  if (!supabase) return null;

  const normalized = address.toLowerCase();

  // First: find a row with agent_id keyed by agent_wallet or agent_owner
  const { data: byAgentWallet } = await supabase
    .from("users")
    .select("*")
    .eq("agent_wallet", normalized)
    .not("agent_id", "is", null)
    .single();

  if (byAgentWallet) return byAgentWallet;

  const { data: byAgentOwner } = await supabase
    .from("users")
    .select("*")
    .eq("agent_owner", normalized)
    .not("agent_id", "is", null)
    .single();

  if (byAgentOwner) return byAgentOwner;

  // Fallback: check standard address columns for rows with agent_id
  const { data: byVerified } = await supabase
    .from("users")
    .select("*")
    .contains("verified_addresses", [normalized])
    .not("agent_id", "is", null)
    .single();

  if (byVerified) return byVerified;

  const { data: byPrimary } = await supabase
    .from("users")
    .select("*")
    .eq("primary_address", normalized)
    .not("agent_id", "is", null)
    .single();

  return byPrimary ?? null;
}
