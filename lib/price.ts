import { type Address, formatUnits } from "viem";
import { publicClient } from "./viem";
import { MCV2_BOND } from "./contracts/constants";

/**
 * Minimal ABI for MCV2_Bond view functions used for price display.
 *
 * - priceForNextMint: returns the cost (in reserve token) to mint 1 token
 * - tokenBond: returns bond metadata including total supply info
 */
const mcv2BondAbi = [
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
    name: "tokenBond",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "mintRoyalty", type: "uint16" },
      { name: "burnRoyalty", type: "uint16" },
      { name: "createdAt", type: "uint40" },
      { name: "reserveToken", type: "address" },
      { name: "reserveBalance", type: "uint256" },
    ],
  },
] as const;

export interface TokenPriceInfo {
  /** Cost to mint 1 full token (18 decimals), formatted as string */
  pricePerToken: string;
  /** Raw price in wei */
  priceRaw: bigint;
  /** Reserve token address */
  reserveToken: Address;
  /** Reserve balance in the bond, formatted */
  reserveBalance: string;
  /** Reserve balance raw */
  reserveBalanceRaw: bigint;
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

    const [priceRaw, bondInfo] = await Promise.all([
      publicClient.readContract({
        address: MCV2_BOND,
        abi: mcv2BondAbi,
        functionName: "priceForNextMint",
        args: [tokenAddress, oneToken],
      }),
      publicClient.readContract({
        address: MCV2_BOND,
        abi: mcv2BondAbi,
        functionName: "tokenBond",
        args: [tokenAddress],
      }),
    ]);

    const [, , , , reserveToken, reserveBalanceRaw] = bondInfo;

    return {
      pricePerToken: formatUnits(priceRaw, 18),
      priceRaw,
      reserveToken: reserveToken as Address,
      reserveBalance: formatUnits(reserveBalanceRaw, 18),
      reserveBalanceRaw,
    };
  } catch {
    return null;
  }
}
