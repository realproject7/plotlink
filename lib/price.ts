import { type Address, formatUnits } from "viem";
import { publicClient } from "./viem";
import { MCV2_BOND } from "./contracts/constants";
import {
  priceForNextMintFunction,
  tokenBondFunction,
} from "./contracts/abi";

/**
 * Minimal ABIs for price display.
 *
 * - MCV2_Bond.priceForNextMint: cost (in reserve token) to mint 1 token
 * - ERC-20 totalSupply: total minted supply of the storyline token
 */
export const mcv2BondAbi = [
  {
    type: "function",
    name: "getReserveForToken",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "tokensToMint", type: "uint256" },
    ],
    outputs: [{ name: "reserveAmount", type: "uint256" }],
  },
  {
    type: "function",
    name: "getRefundForTokens",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "tokensToBurn", type: "uint256" },
    ],
    outputs: [{ name: "refundAmount", type: "uint256" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "tokensToMint", type: "uint256" },
      { name: "maxReserveAmount", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "burn",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "tokensToBurn", type: "uint256" },
      { name: "minRefund", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getRoyaltyInfo",
    stateMutability: "view",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "reserveToken", type: "address" },
    ],
    outputs: [
      { name: "balance", type: "uint256" },
      { name: "claimed", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "claimRoyalties",
    stateMutability: "nonpayable",
    inputs: [{ name: "reserveToken", type: "address" }],
    outputs: [],
  },
  priceForNextMintFunction,
  tokenBondFunction,
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export interface TokenPriceInfo {
  /** Cost to mint 1 full token (18 decimals), formatted as string */
  pricePerToken: string;
  /** Raw price in wei */
  priceRaw: bigint;
  /** Total minted supply, formatted */
  totalSupply: string;
  /** Total minted supply raw */
  totalSupplyRaw: bigint;
}

/**
 * Fetch current token price and bond info from MCV2_Bond for a storyline token.
 * Uses priceForNextMint for a simpler, single-call price read.
 *
 * Returns null if the token has no bond or the query fails.
 */
export async function getTokenPrice(
  tokenAddress: Address,
): Promise<TokenPriceInfo | null> {
  try {
    const [priceRaw, totalSupplyRaw] = await Promise.all([
      publicClient.readContract({
        address: MCV2_BOND,
        abi: mcv2BondAbi,
        functionName: "priceForNextMint",
        args: [tokenAddress],
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "totalSupply",
      }),
    ]);

    return {
      pricePerToken: formatUnits(priceRaw, 18),
      priceRaw: BigInt(priceRaw),
      totalSupply: formatUnits(totalSupplyRaw, 18),
      totalSupplyRaw,
    };
  } catch {
    return null;
  }
}

/** ~24 hours of blocks on Base at 2s block time */
const BLOCKS_PER_24H = BigInt(43200);

/**
 * Get 24h price change percentage for a token using on-chain block diff.
 * Compares priceForNextMint at current block vs ~24h ago.
 *
 * Returns null if the read fails (e.g. token didn't exist 24h ago).
 */
export async function get24hPriceChange(
  tokenAddress: Address,
): Promise<{ changePercent: number; currentPrice: bigint; previousPrice: bigint } | null> {
  try {
    const currentBlock = await publicClient.getBlockNumber();
    const pastBlock = currentBlock - BLOCKS_PER_24H;

    const [currentPrice, previousPrice] = await Promise.all([
      publicClient.readContract({
        address: MCV2_BOND,
        abi: mcv2BondAbi,
        functionName: "priceForNextMint",
        args: [tokenAddress],
      }),
      publicClient.readContract({
        address: MCV2_BOND,
        abi: mcv2BondAbi,
        functionName: "priceForNextMint",
        args: [tokenAddress],
        blockNumber: pastBlock,
      }),
    ]);

    const current = BigInt(currentPrice);
    const previous = BigInt(previousPrice);

    if (previous === BigInt(0)) {
      return { changePercent: 0, currentPrice: current, previousPrice: previous };
    }

    const changePercent =
      Number(((current - previous) * BigInt(10000)) / previous) / 100;

    return { changePercent, currentPrice: current, previousPrice: previous };
  } catch {
    return null;
  }
}

const erc20DecimalsAbi = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

/**
 * Get TVL (reserve balance) for a token from its MCV2_Bond tokenBond data.
 * Fetches the reserve token's decimals on-chain for correct formatting.
 *
 * Returns null if the read fails.
 */
export async function getTokenTVL(
  tokenAddress: Address,
): Promise<{ tvl: string; tvlRaw: bigint; reserveToken: Address; decimals: number } | null> {
  try {
    const result = await publicClient.readContract({
      address: MCV2_BOND,
      abi: mcv2BondAbi,
      functionName: "tokenBond",
      args: [tokenAddress],
    });

    const [, , , , reserveToken, reserveBalance] = result;
    const reserveAddr = reserveToken as Address;

    const decimals = await publicClient.readContract({
      address: reserveAddr,
      abi: erc20DecimalsAbi,
      functionName: "decimals",
    });

    return {
      tvl: formatUnits(reserveBalance, decimals),
      tvlRaw: reserveBalance,
      reserveToken: reserveAddr,
      decimals,
    };
  } catch {
    return null;
  }
}
