"use server";

import { lookupByAddress, type FarcasterProfile } from "./farcaster";

/**
 * Server action that resolves an Ethereum address to a Farcaster profile.
 * Callable from client components without exposing the API key.
 */
export async function getFarcasterProfile(
  address: string,
): Promise<FarcasterProfile | null> {
  return lookupByAddress(address);
}
