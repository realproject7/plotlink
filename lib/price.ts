import { type Address, formatUnits } from "viem";
import { publicClient } from "./viem";
import { MCV2_BOND } from "./contracts/constants";

/**
 * Minimal ABIs for price display.
 *
 * - MCV2_Bond.priceForNextMint: cost (in reserve token) to mint 1 token
 * - ERC-20 totalSupply: total minted supply of the storyline token
 */
export const mcv2BondAbi = [
  {
    type: "function",
    name: "priceForNextMint",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "price", type: "uint256" }],
  },
  {
    type: "function",
    name: "priceForNextBurn",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "price", type: "uint256" }],
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
 *
 * Returns null if the token has no bond or the query fails.
 */
export async function getTokenPrice(
  tokenAddress: Address,
): Promise<TokenPriceInfo | null> {
  try {
    const oneToken = BigInt(10 ** 18);

    const [priceRaw, totalSupplyRaw] = await Promise.all([
      publicClient.readContract({
        address: MCV2_BOND,
        abi: mcv2BondAbi,
        functionName: "priceForNextMint",
        args: [tokenAddress, oneToken],
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "totalSupply",
      }),
    ]);

    return {
      pricePerToken: formatUnits(priceRaw, 18),
      priceRaw,
      totalSupply: formatUnits(totalSupplyRaw, 18),
      totalSupplyRaw,
    };
  } catch {
    return null;
  }
}
