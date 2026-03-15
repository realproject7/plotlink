import type { Command } from "commander";
import { type Address, erc20Abi, formatUnits, isAddress } from "viem";
import { buildClient } from "../sdk.js";

export function registerClaim(program: Command): void {
  program
    .command("claim")
    .description("Claim accumulated royalties for a storyline token")
    .requiredOption("-a, --address <tokenAddress>", "Storyline ERC-20 token address")
    .action(async (opts: { address: string }) => {
      try {
        if (!isAddress(opts.address)) {
          console.error(`Invalid address: ${opts.address}`);
          process.exit(1);
        }
        const tokenAddress = opts.address as Address;
        const client = buildClient({ ipfs: false });

        console.log("Checking royalties...");
        const info = await client.getRoyaltyInfo(tokenAddress);

        // Fetch reserve token decimals dynamically
        let decimals = 18;
        try {
          decimals = await client.publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "decimals",
          });
        } catch {
          // Default to 18 if decimals() call fails
        }

        const formatted = formatUnits(info.unclaimed, decimals);
        console.log(`  Unclaimed:    ${formatted}`);
        console.log(`  Beneficiary:  ${info.beneficiary}`);

        if (info.unclaimed === 0n) {
          console.log("No royalties to claim.");
          return;
        }

        console.log("Claiming royalties...");
        const txHash = await client.claimRoyalties(tokenAddress);
        console.log(`Royalties claimed! TX: ${txHash}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
