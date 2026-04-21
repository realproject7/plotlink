/**
 * Shared SIWE wallet ownership verification (#883)
 *
 * Extracts address from a SIWE-style message and verifies the signature.
 */

import { verifyMessage } from "viem";

/**
 * Verify wallet ownership via signed message.
 * Returns the verified lowercase address, or null if verification fails.
 */
export async function verifyWalletOwnership(
  message: string,
  signature: `0x${string}`,
): Promise<string | null> {
  // Parse address from SIWE message
  const addressMatch =
    message.match(/^(0x[a-fA-F0-9]{40})/m) ??
    message.match(/wants you to sign in with your Ethereum account:\n(0x[a-fA-F0-9]{40})/);

  if (!addressMatch) return null;

  const address = addressMatch[1].toLowerCase();

  try {
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature,
    });
    return valid ? address : null;
  } catch {
    return null;
  }
}
