import type { Command } from "commander";
import type { Address } from "viem";
import { buildClient } from "../sdk.js";

export function registerClaim(program: Command): void {
  program
    .command("claim")
    .description("Claim accumulated royalties for a storyline token")
    .requiredOption("-a, --address <tokenAddress>", "Storyline ERC-20 token address")
    .action(async (opts: { address: string }) => {
      try {
        const tokenAddress = opts.address as Address;
        const client = buildClient({ ipfs: false });

        console.log("Checking royalties...");
        const info = await client.getRoyaltyInfo(tokenAddress);
        console.log(`  Unclaimed:    ${info.unclaimed}`);
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
