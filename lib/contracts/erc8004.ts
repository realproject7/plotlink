import { type Address } from "viem";
import { publicClient } from "../rpc";
import { ERC8004_REGISTRY } from "./constants";
import { createServiceRoleClient } from "../supabase";

// ---------------------------------------------------------------------------
// ABI
// ---------------------------------------------------------------------------

/**
 * ERC-8004 Agent Registry ABI — agent registration, wallet binding, and
 * reverse lookup.
 */
export interface AgentMetadata {
  agentId?: string;
  owner?: string;
  name: string;
  description: string;
  genre?: string;
  llmModel?: string;
  registeredBy?: string;
  registeredAt?: string;
}

export const erc8004Abi = [
  // View — reverse lookup wallet → agentId
  {
    type: "function",
    name: "agentIdByWallet",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  // View — fetch metadata URI for an agent
  {
    type: "function",
    name: "agentURI",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  // View — get the bound agent wallet for an agentId
  {
    type: "function",
    name: "getAgentWallet",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  // View — get arbitrary metadata by key
  {
    type: "function",
    name: "getMetadata",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "metadataKey", type: "string" },
    ],
    outputs: [{ name: "", type: "bytes" }],
  },
  // View — ERC-721: owner of a token (agentId)
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "owner", type: "address" }],
  },
  // View — ERC-721: number of tokens owned by an address
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  // View — ERC-721 Enumerable: token at index for owner
  {
    type: "function",
    name: "tokenOfOwnerByIndex",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Write — register a new agent
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  // Write — bind a wallet to an agent (EIP-712 signed)
  {
    type: "function",
    name: "setAgentWallet",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newWallet", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  // Write — remove agent wallet binding
  {
    type: "function",
    name: "unsetAgentWallet",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [],
  },
  // Write — update agent URI (owner/approved only)
  {
    type: "function",
    name: "setAgentURI",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newURI", type: "string" },
    ],
    outputs: [],
  },
  // Write — set arbitrary metadata key/value
  {
    type: "function",
    name: "setMetadata",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "metadataKey", type: "string" },
      { name: "metadataValue", type: "bytes" },
    ],
    outputs: [],
  },
  // Event — emitted on successful registration
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
  // Event — emitted when URI is updated
  {
    type: "event",
    name: "URIUpdated",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "newURI", type: "string", indexed: false },
      { name: "updatedBy", type: "address", indexed: true },
    ],
  },
  // Event — emitted when metadata is set
  {
    type: "event",
    name: "MetadataSet",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "indexedMetadataKey", type: "string", indexed: true },
      { name: "metadataKey", type: "string", indexed: false },
      { name: "metadataValue", type: "bytes", indexed: false },
    ],
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
    // DB-first: check if this address is a cached agent wallet
    const supabase = createServiceRoleClient();
    if (supabase) {
      const normalized = writerAddress.toLowerCase();
      const { data } = await supabase
        .from("users")
        .select("agent_id")
        .or(`agent_wallet.eq.${normalized},primary_address.eq.${normalized}`)
        .not("agent_id", "is", null)
        .limit(1)
        .single();
      if (data?.agent_id) return 1;
    }

    // RPC fallback for agents not yet in DB
    const agentId = await publicClient.readContract({
      address: ERC8004_REGISTRY,
      abi: erc8004Abi,
      functionName: "agentIdByWallet",
      args: [writerAddress],
    });
    return agentId > BigInt(0) ? 1 : 0;
  } catch {
    // Best-effort: default to human if both checks fail
    return 0;
  }
}

/**
 * Resolve an agent URI string to a parsed JSON object.
 * Handles raw JSON, data: URIs (base64 + URL-encoded), https://, and ipfs://.
 */
export async function resolveAgentURI(uri: string): Promise<Record<string, unknown>> {
  if (uri.startsWith("{")) {
    return JSON.parse(uri);
  }
  if (uri.startsWith("data:")) {
    const comma = uri.indexOf(",");
    const payload = comma >= 0 ? uri.slice(comma + 1) : uri;
    return JSON.parse(
      uri.includes("base64") ? atob(payload) : decodeURIComponent(payload),
    );
  }
  // https:// or ipfs://
  const fetchUrl = uri.startsWith("ipfs://")
    ? uri.replace("ipfs://", "https://ipfs.io/ipfs/")
    : uri;
  const res = await fetch(fetchUrl);
  return (await res.json()) as Record<string, unknown>;
}

/**
 * Resolve ERC-8004 agent metadata from an Ethereum address.
 * Returns null if the address is not a registered agent or on any error.
 */
export async function getAgentMetadata(
  walletAddress: Address,
): Promise<AgentMetadata | null> {
  try {
    const agentId = await publicClient.readContract({
      address: ERC8004_REGISTRY,
      abi: erc8004Abi,
      functionName: "agentIdByWallet",
      args: [walletAddress],
    });
    if (agentId <= BigInt(0)) return null;

    const [uri, owner] = await Promise.all([
      publicClient.readContract({
        address: ERC8004_REGISTRY,
        abi: erc8004Abi,
        functionName: "agentURI",
        args: [agentId],
      }),
      publicClient.readContract({
        address: ERC8004_REGISTRY,
        abi: erc8004Abi,
        functionName: "ownerOf",
        args: [agentId],
      }).catch(() => undefined),
    ]);
    if (!uri) return null;

    const parsed = await resolveAgentURI(uri as string);
    return {
      agentId: agentId.toString(),
      owner: owner as string | undefined,
      name: (parsed.name as string) || "Unknown Agent",
      description: (parsed.description as string) || "",
      genre: (parsed.genre as string) || undefined,
      llmModel: (parsed.llmModel as string) || (parsed.model as string) || undefined,
      registeredBy: (parsed.registeredBy as string) || undefined,
      registeredAt: (parsed.registeredAt as string) || undefined,
    };
  } catch {
    return null;
  }
}
