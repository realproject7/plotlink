"use server";

import { lookupByAddress, type FarcasterProfile } from "./farcaster";
import {
  getAgentMetadata as _getAgentMetadata,
  getAgentMetadataById as _getAgentMetadataById,
  type AgentMetadata,
} from "./contracts/erc8004";
import { createServiceRoleClient, type User } from "./supabase";
import type { Address } from "viem";

/**
 * Server action that resolves an Ethereum address to a Farcaster profile.
 * Prefers cached DB data, falls back to live API.
 * Accepts an optional pre-fetched dbUser to avoid redundant DB lookups.
 */
export async function getFarcasterProfile(
  address: string,
  dbUser?: User | null,
): Promise<FarcasterProfile | null> {
  // Try DB first (only if user has a FID — wallet-only users have no Farcaster profile)
  const user = dbUser !== undefined ? dbUser : await getUserFromDB(address);
  if (user && user.fid != null) {
    return {
      fid: user.fid,
      username: user.username ?? "",
      displayName: user.display_name ?? user.username ?? "",
      pfpUrl: user.pfp_url ?? null,
      bio: user.bio ?? null,
    };
  }
  // Fallback to live API
  return lookupByAddress(address);
}

/**
 * Server action that resolves ERC-8004 agent metadata from a wallet address.
 * Checks DB cache first, falls back to RPC. Caches externally registered agents.
 * Accepts an optional pre-fetched dbUser to avoid redundant DB lookups.
 */
export async function fetchAgentMetadata(
  address: string,
  preloadedUser?: User | null,
): Promise<AgentMetadata | null> {
  // DB-first: check cached agent data.
  // Use preloaded user if it has agent_id; otherwise fall back to agent-specific lookup.
  const dbUser = preloadedUser?.agent_id != null
    ? preloadedUser
    : await getAgentUserFromDB(address);
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
 * Fetch the full user profile in a single DB lookup.
 * Returns dbUser, fcProfile, and agentMeta derived from one shared row.
 * External API fallbacks still fire when DB data is missing.
 */
export async function getFullUserProfile(
  address: string,
): Promise<{
  dbUser: User | null;
  fcProfile: FarcasterProfile | null;
  agentMeta: AgentMetadata | null;
  isAgentOwner: boolean;
  linkedAgentMeta: AgentMetadata | null;
}> {
  const dbUser = await getUserFromDB(address);
  const [fcProfile, agentMeta] = await Promise.all([
    getFarcasterProfile(address, dbUser),
    fetchAgentMetadata(address, dbUser),
  ]);

  // Detect if this address is the agent OWNER (not the agent itself).
  // When true, the profile should display human identity, not agent identity.
  // A human with linked_agent_wallet is an agent owner (DB-only OWS link).
  // Direct agents (agent_type='direct') are the agent themselves — isAgentOwner stays false.
  // Legacy rows with agent_type='ows-writer' also count as agent owners (backward compat).
  const normalized = address.toLowerCase();
  const hasLinkedAgent = dbUser?.linked_agent_wallet != null;
  const isOwner = agentMeta !== null && agentMeta.owner?.toLowerCase() === normalized;
  const isAgentOwner = hasLinkedAgent
    || (isOwner
      && (dbUser?.agent_type === "ows-writer"
        || (dbUser?.agent_type == null
          && (dbUser?.agent_wallet == null || dbUser.agent_wallet.toLowerCase() !== normalized))));

  // For agent owners with linked_agent_wallet, fetch the linked agent's metadata
  let linkedAgentMeta: AgentMetadata | null = null;
  if (hasLinkedAgent) {
    linkedAgentMeta = await fetchAgentMetadata(dbUser!.linked_agent_wallet!);
  }

  return { dbUser, fcProfile, agentMeta, isAgentOwner, linkedAgentMeta };
}

/**
 * Check if a user exists in the DB (any row, with or without agent_id).
 * Returns true if a known user, false if completely unknown wallet.
 */
export async function checkUserExists(
  address: string,
): Promise<boolean> {
  const user = await getUserFromDB(address);
  return user !== null;
}

/**
 * Cache an externally registered agent by agentId.
 * Use when the wallet is an NFT owner (not the bound agent wallet),
 * so agentIdByWallet() wouldn't find it.
 */
export async function cacheAgentById(
  walletAddress: string,
  agentId: string,
): Promise<void> {
  const supabase = createServiceRoleClient();
  if (!supabase) return;

  const normalized = walletAddress.toLowerCase();

  // Check if already cached
  const { data: existing } = await supabase
    .from("users")
    .select("agent_id")
    .eq("agent_id", Number(agentId))
    .single();
  if (existing) return;

  // Fetch metadata from RPC by agentId
  const meta = await _getAgentMetadataById(BigInt(agentId));
  if (!meta) return;

  const agentFields = {
    agent_id: Number(meta.agentId),
    agent_name: meta.name || null,
    agent_description: meta.description || null,
    agent_genre: meta.genre || null,
    agent_llm_model: meta.llmModel || null,
    agent_owner: meta.owner?.toLowerCase() || normalized,
    agent_wallet: meta.agentWallet && meta.agentWallet !== "0x0000000000000000000000000000000000000000" ? meta.agentWallet.toLowerCase() : null,
    agent_registered_at: meta.registeredAt || null,
  };

  // Find existing user row or create one
  const dbUser = await getUserFromDB(walletAddress);
  try {
    if (dbUser) {
      await supabase.from("users").update(agentFields).eq("id", dbUser.id);
    } else {
      await supabase.from("users").insert({ primary_address: normalized, ...agentFields });
    }
  } catch {
    // Best-effort
  }
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

/**
 * For a writer address, check if it's an ERC-8004 agent and return agent info
 * plus the owner's Farcaster profile (if available).
 * Returns null only if the address is NOT an agent.
 *
 * Also checks linked_agent_wallet reverse lookup: if a human has
 * linked_agent_wallet pointing to this address, returns the human as owner.
 */
export async function getAgentOwnerProfile(
  writerAddress: string,
): Promise<{ ownerProfile: FarcasterProfile | null; agentName: string; agentId: number } | null> {
  "use server";
  const normalized = writerAddress.toLowerCase();

  // Check if this address is someone's linked_agent_wallet (DB-only OWS link)
  const supabase = createServiceRoleClient();
  if (supabase) {
    const { data: linkedOwner } = await supabase
      .from("users")
      .select("*")
      .eq("linked_agent_wallet", normalized)
      .single();

    if (linkedOwner) {
      // This address IS an OWS agent wallet — look up the agent's own row for metadata
      const agentUser = await getAgentUserFromDB(writerAddress);
      const ownerProfile = await getFarcasterProfile(
        linkedOwner.primary_address || linkedOwner.verified_addresses?.[0] || "",
        linkedOwner,
      );
      return {
        ownerProfile,
        agentName: agentUser?.agent_name || "AI Writer",
        agentId: agentUser?.agent_id || 0,
      };
    }
  }

  // Legacy path: check agent columns directly
  const agentUser = await getAgentUserFromDB(writerAddress);
  if (!agentUser?.agent_id) return null;

  // If the queried address is an OWS-linked owner (not the agent itself),
  // this address belongs to the human owner — not an agent.
  // Direct agents (agent_type='direct') are the agent themselves and should not be excluded.
  // Legacy rows (agent_type=null) fall back to the old wallet-null heuristic.
  const isOwnerAddress = agentUser.agent_owner?.toLowerCase() === normalized;
  const isAgentWallet = agentUser.agent_wallet?.toLowerCase() === normalized;
  const isLinkedOwner = isOwnerAddress
    && (agentUser.agent_type === "ows-writer"
      || (agentUser.agent_type == null && !isAgentWallet));
  if (isLinkedOwner) return null;

  const ownerProfile = agentUser.agent_owner
    ? await getFarcasterProfile(agentUser.agent_owner)
    : null;

  return {
    ownerProfile,
    agentName: agentUser.agent_name || `Agent #${agentUser.agent_id}`,
    agentId: agentUser.agent_id,
  };
}
