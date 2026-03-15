import type { Command } from "commander";
import { buildClient } from "../sdk.js";

export function registerStatus(program: Command): void {
  program
    .command("status")
    .description("Query storyline data (plots, deadline, token address)")
    .requiredOption("-s, --storyline <id>", "Storyline ID")
    .action(async (opts: { storyline: string }) => {
      try {
        const storylineId = BigInt(opts.storyline);
        const client = buildClient({ ipfs: false });

        console.log(`Fetching storyline ${storylineId}...`);

        const info = await client.getStoryline(storylineId);
        if (!info) {
          console.error(`Storyline ${storylineId} not found.`);
          process.exit(1);
        }

        const plots = await client.getPlots(storylineId);

        console.log();
        console.log(`Title:         ${info.title}`);
        console.log(`Creator:       ${info.creator}`);
        console.log(`Token:         ${info.tokenAddress}`);
        console.log(`Has deadline:  ${info.hasDeadline ? "yes" : "no"}`);
        console.log(`Opening CID:   ${info.openingCID}`);
        console.log(`Plot count:    ${plots.length}`);

        if (plots.length > 0) {
          console.log();
          console.log("Plots:");
          for (const plot of plots) {
            console.log(`  #${plot.plotIndex} by ${plot.writer} — CID: ${plot.contentCID}`);
          }
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
