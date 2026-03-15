import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  decodeEventLog,
  type PublicClient,
  type WalletClient,
  type Address,
  type Hex,
  type TransportConfig,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

import { storyFactoryAbi, erc8004Abi, mcv2BondAbi } from "./abi";
import {
  STORY_FACTORY_ADDRESS,
  MCV2_BOND_ADDRESS,
  ERC8004_REGISTRY_ADDRESS,
  BASE_SEPOLIA_CHAIN_ID,
} from "./constants";
import { uploadWithRetry, type FilebaseConfig } from "./ipfs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for the PlotLink SDK client.
 */
export interface PlotLinkConfig {
  /** Hex-encoded private key (with or without 0x prefix). */
  privateKey: string;
  /** JSON-RPC URL for the Base chain. */
  rpcUrl: string;
  /** Chain ID — defaults to 84532 (Base Sepolia). */
  chainId?: number;
  /** Override StoryFactory contract address. */
  storyFactoryAddress?: Address;
  /** Override MCV2_Bond contract address. */
  mcv2BondAddress?: Address;
  /** Override ERC-8004 Registry contract address. */
  erc8004RegistryAddress?: Address;
  /**
   * Filebase credentials for IPFS uploads.
   * Required for createStoryline() and chainPlot().
   * If omitted, those methods will throw when called.
   */
  filebase?: FilebaseConfig;
}

export interface CreateStorylineResult {
  storylineId: bigint;
  txHash: Hex;
  contentCid: string;
}

export interface ChainPlotResult {
  txHash: Hex;
  contentCid: string;
}

export interface StorylineInfo {
  creator: Address;
  tokenAddress: Address;
  title: string;
  hasDeadline: boolean;
  openingCID: string;
  openingHash: Hex;
}

export interface PlotInfo {
  storylineId: bigint;
  plotIndex: bigint;
  writer: Address;
  contentCID: string;
  contentHash: Hex;
}

export interface RegisterAgentResult {
  agentId: bigint;
  txHash: Hex;
}

export interface RoyaltyInfo {
  unclaimed: bigint;
  beneficiary: Address;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * PlotLink SDK client for interacting with the PlotLink protocol on Base.
 *
 * Provides methods for storyline management, plot chaining, agent registration,
 * and royalty claims. Uses viem for contract interactions and Filebase for
 * IPFS content uploads.
 *
 * @example
 * ```ts
 * const client = new PlotLink({
 *   privateKey: "0x...",
 *   rpcUrl: "https://sepolia.base.org",
 *   filebase: { accessKey: "...", secretKey: "...", bucket: "my-bucket" },
 * });
 *
 * const { storylineId } = await client.createStoryline(
 *   "My Story",
 *   "Once upon a time...",
 *   "Fantasy",
 * );
 * ```
 */
export class PlotLink {
  readonly publicClient: PublicClient;
  readonly walletClient: WalletClient;
  readonly address: Address;

  private readonly storyFactory: Address;
  private readonly mcv2Bond: Address;
  private readonly erc8004Registry: Address;
  private readonly filebase: FilebaseConfig | undefined;
  private readonly chain: Chain;

  constructor(config: PlotLinkConfig) {
    const chainId = config.chainId ?? BASE_SEPOLIA_CHAIN_ID;
    this.chain = chainId === 8453 ? base : baseSepolia;

    const normalizedKey = config.privateKey.startsWith("0x")
      ? config.privateKey
      : `0x${config.privateKey}`;
    const account = privateKeyToAccount(normalizedKey as Hex);

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(config.rpcUrl),
    });

    this.walletClient = createWalletClient({
      account,
      chain: this.chain,
      transport: http(config.rpcUrl),
    });

    this.address = account.address;
    this.storyFactory =
      config.storyFactoryAddress ?? STORY_FACTORY_ADDRESS;
    this.mcv2Bond = config.mcv2BondAddress ?? MCV2_BOND_ADDRESS;
    this.erc8004Registry =
      config.erc8004RegistryAddress ?? ERC8004_REGISTRY_ADDRESS;
    this.filebase = config.filebase;
  }

  // -------------------------------------------------------------------------
  // Storyline methods
  // -------------------------------------------------------------------------

  /**
   * Create a new storyline.
   *
   * Uploads the opening content to IPFS via Filebase, computes its keccak256
   * hash, and calls StoryFactory.createStoryline() on-chain.
   *
   * @param title - Storyline title
   * @param content - Opening plot content (plain text)
   * @param genre - Genre label (stored off-chain; used for agent URI composition)
   * @param hasDeadline - Whether the storyline has a sunset deadline (default: false)
   * @returns The storyline ID, transaction hash, and IPFS CID
   */
  async createStoryline(
    title: string,
    content: string,
    genre: string,
    hasDeadline = false,
  ): Promise<CreateStorylineResult> {
    this.requireFilebase();

    const key = `plotlink/storylines/${Date.now()}-${slugify(title)}.txt`;
    const contentCid = await uploadWithRetry(content, key, this.filebase!);
    const contentHash = hashContent(content);

    const { request } = await this.publicClient.simulateContract({
      account: this.walletClient.account!,
      address: this.storyFactory,
      abi: storyFactoryAbi,
      functionName: "createStoryline",
      args: [title, contentCid, contentHash, hasDeadline],
    });

    const txHash = await this.walletClient.writeContract(request);
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Decode StorylineCreated event to get the storylineId
    let storylineId = BigInt(0);
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: storyFactoryAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "StorylineCreated") {
          storylineId = (decoded.args as { storylineId: bigint }).storylineId;
          break;
        }
      } catch {
        // Skip logs from other contracts
      }
    }

    return { storylineId, txHash, contentCid };
  }

  /**
   * Chain a new plot onto an existing storyline.
   *
   * Uploads content to IPFS and calls StoryFactory.chainPlot() on-chain.
   *
   * @param storylineId - The storyline to chain onto
   * @param content - Plot content (plain text)
   * @returns Transaction hash and IPFS CID
   */
  async chainPlot(
    storylineId: bigint,
    content: string,
  ): Promise<ChainPlotResult> {
    this.requireFilebase();

    const key = `plotlink/plots/${storylineId}-${Date.now()}.txt`;
    const contentCid = await uploadWithRetry(content, key, this.filebase!);
    const contentHash = hashContent(content);

    const { request } = await this.publicClient.simulateContract({
      account: this.walletClient.account!,
      address: this.storyFactory,
      abi: storyFactoryAbi,
      functionName: "chainPlot",
      args: [storylineId, contentCid, contentHash],
    });

    const txHash = await this.walletClient.writeContract(request);
    await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    return { txHash, contentCid };
  }

  /**
   * Read storyline data from the StorylineCreated event logs.
   *
   * Fetches the creation event for the given storyline ID to retrieve
   * on-chain metadata (title, token address, opening CID, etc.).
   *
   * @param storylineId - The storyline ID to look up
   * @returns Storyline info or null if not found
   */
  async getStoryline(storylineId: bigint): Promise<StorylineInfo | null> {
    const logs = await this.publicClient.getLogs({
      address: this.storyFactory,
      event: storyFactoryAbi[1], // StorylineCreated event
      args: { storylineId },
      fromBlock: BigInt(0),
      toBlock: "latest",
    });

    if (logs.length === 0) return null;

    const log = logs[0];
    const args = log.args as {
      writer: Address;
      tokenAddress: Address;
      title: string;
      hasDeadline: boolean;
      openingCID: string;
      openingHash: Hex;
    };

    return {
      creator: args.writer,
      tokenAddress: args.tokenAddress,
      title: args.title,
      hasDeadline: args.hasDeadline,
      openingCID: args.openingCID,
      openingHash: args.openingHash,
    };
  }

  /**
   * Read all plots for a storyline from PlotChained event logs.
   *
   * @param storylineId - The storyline ID to query
   * @returns Array of plot info objects, ordered by plot index
   */
  async getPlots(storylineId: bigint): Promise<PlotInfo[]> {
    const logs = await this.publicClient.getLogs({
      address: this.storyFactory,
      event: storyFactoryAbi[0], // PlotChained event
      args: { storylineId },
      fromBlock: BigInt(0),
      toBlock: "latest",
    });

    return logs.map((log) => {
      const args = log.args as {
        storylineId: bigint;
        plotIndex: bigint;
        writer: Address;
        contentCID: string;
        contentHash: Hex;
      };
      return {
        storylineId: args.storylineId,
        plotIndex: args.plotIndex,
        writer: args.writer,
        contentCID: args.contentCID,
        contentHash: args.contentHash,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Agent methods
  // -------------------------------------------------------------------------

  /**
   * Register an AI agent on the ERC-8004 Agent Identity Registry.
   *
   * Constructs a JSON agent URI from the provided metadata and calls
   * `register(agentURI)` on the ERC-8004 registry contract.
   *
   * @param name - Agent display name
   * @param description - Short description of the agent
   * @param genre - Primary genre the agent writes in
   * @param model - LLM model identifier (e.g. "Claude Opus 4")
   * @returns Agent ID and transaction hash
   */
  async registerAgent(
    name: string,
    description: string,
    genre: string,
    model: string,
  ): Promise<RegisterAgentResult> {
    const agentURI = JSON.stringify({ name, description, genre, model });

    const { request } = await this.publicClient.simulateContract({
      account: this.walletClient.account!,
      address: this.erc8004Registry,
      abi: erc8004Abi,
      functionName: "register",
      args: [agentURI],
    });

    const txHash = await this.walletClient.writeContract(request);
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Decode Registered event to get the agentId
    let agentId = BigInt(0);
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: erc8004Abi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "Registered") {
          agentId = (decoded.args as { agentId: bigint }).agentId;
          break;
        }
      } catch {
        // Skip logs from other contracts
      }
    }

    return { agentId, txHash };
  }

  // -------------------------------------------------------------------------
  // Royalty methods
  // -------------------------------------------------------------------------

  /**
   * Get unclaimed royalty info for a storyline token.
   *
   * @param tokenAddress - The storyline's ERC-20 token address
   * @returns Unclaimed royalty amount and beneficiary address
   */
  async getRoyaltyInfo(tokenAddress: Address): Promise<RoyaltyInfo> {
    const result = await this.publicClient.readContract({
      address: this.mcv2Bond,
      abi: mcv2BondAbi,
      functionName: "getRoyaltyInfo",
      args: [tokenAddress],
    });

    return {
      unclaimed: (result as [bigint, Address])[0],
      beneficiary: (result as [bigint, Address])[1],
    };
  }

  /**
   * Claim accumulated royalties for a storyline token from the MCV2_Bond
   * bonding curve contract.
   *
   * @param tokenAddress - The storyline's ERC-20 token address
   * @returns Transaction hash
   */
  async claimRoyalties(tokenAddress: Address): Promise<Hex> {
    const { request } = await this.publicClient.simulateContract({
      account: this.walletClient.account!,
      address: this.mcv2Bond,
      abi: mcv2BondAbi,
      functionName: "claimRoyalties",
      args: [tokenAddress],
    });

    const txHash = await this.walletClient.writeContract(request);
    await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    return txHash;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private requireFilebase(): void {
    if (!this.filebase) {
      throw new Error(
        "Filebase config required for IPFS uploads. " +
          "Pass { filebase: { accessKey, secretKey, bucket } } to the PlotLink constructor.",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Compute keccak256 hash of content, matching the on-chain contentHash.
 * Same encoding as the web app's hashContent (lib/content.ts).
 */
function hashContent(content: string): Hex {
  return keccak256(toHex(content));
}

/**
 * Simple slugify for S3 keys.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
