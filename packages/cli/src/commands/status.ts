import type { Command } from "commander";
import { createClient } from "@supabase/supabase-js";
import { type Address, erc20Abi, formatUnits } from "viem";
import { buildClient } from "../sdk.js";
import { loadConfig } from "../config.js";

export function registerStatus(program: Command): void {
  program
    .command("status")
    .description("Query storyline data (plots, deadline, token price) from Supabase and on-chain")
    .requiredOption("-s, --storyline <id>", "Storyline ID")
    .action(async (opts: { storyline: string }) => {
      try {
        const storylineId = BigInt(opts.storyline);
        const cfg = loadConfig();
        const client = buildClient({ ipfs: false });

        console.log(`Fetching storyline ${storylineId}...`);

        // -----------------------------------------------------------------
        // 1. On-chain event data (always available)
        // -----------------------------------------------------------------
        const info = await client.getStoryline(storylineId);
        if (!info) {
          console.error(`Storyline ${storylineId} not found on-chain.`);
          process.exit(1);
        }

        // -----------------------------------------------------------------
        // 2. Supabase metadata (optional — richer data when configured)
        // -----------------------------------------------------------------
        let dbRow: {
          plot_count: number;
          last_plot_time: string | null;
          has_deadline: boolean;
          sunset: boolean;
          writer_type: number | null;
          block_timestamp: string | null;
        } | null = null;

        if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
          const supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
          const { data } = await supabase
            .from("storylines")
            .select("plot_count, last_plot_time, has_deadline, sunset, writer_type, block_timestamp")
            .eq("storyline_id", Number(storylineId))
            .single();
          dbRow = data;
        }

        // -----------------------------------------------------------------
        // 3. Reserve token metadata (symbol + decimals)
        // -----------------------------------------------------------------
        let tokenSymbol = "TOKEN";
        let tokenDecimals = 18;
        try {
          const [sym, dec] = await Promise.all([
            client.publicClient.readContract({
              address: info.tokenAddress,
              abi: erc20Abi,
              functionName: "symbol",
            }),
            client.publicClient.readContract({
              address: info.tokenAddress,
              abi: erc20Abi,
              functionName: "decimals",
            }),
          ]);
          tokenSymbol = sym;
          tokenDecimals = dec;
        } catch {
          // Fall back to defaults if token doesn't support ERC-20 metadata
        }

        // -----------------------------------------------------------------
        // 4. On-chain token price (MCV2_Bond)
        // -----------------------------------------------------------------
        const tokenPrice = await client.getTokenPrice(info.tokenAddress);

        // -----------------------------------------------------------------
        // 5. On-chain royalty info
        // -----------------------------------------------------------------
        let unclaimedRoyalty: bigint | null = null;
        try {
          const royalty = await client.getRoyaltyInfo(info.tokenAddress);
          unclaimedRoyalty = royalty.unclaimed;
        } catch {
          // Token may not have a bond yet
        }

        // -----------------------------------------------------------------
        // 6. Fall back to event-derived plot count if no Supabase
        // -----------------------------------------------------------------
        let plotCount: number;
        if (dbRow) {
          plotCount = dbRow.plot_count;
        } else {
          const plots = await client.getPlots(storylineId);
          plotCount = plots.length;
        }

        // -----------------------------------------------------------------
        // Display
        // -----------------------------------------------------------------
        console.log();
        console.log(`Title:            ${info.title}`);
        console.log(`Creator:          ${info.creator}`);
        console.log(`Token:            ${info.tokenAddress}`);
        console.log(`Has deadline:     ${info.hasDeadline ? "yes" : "no"}`);
        console.log(`Opening CID:      ${info.openingCID}`);
        console.log(`Plot count:       ${plotCount}`);

        if (dbRow) {
          console.log(`Sunset:           ${dbRow.sunset ? "yes" : "no"}`);
          console.log(`Writer type:      ${dbRow.writer_type === 1 ? "agent" : dbRow.writer_type === 0 ? "human" : "unknown"}`);
          if (dbRow.block_timestamp) {
            console.log(`Created:          ${new Date(dbRow.block_timestamp).toISOString()}`);
          }
          if (dbRow.last_plot_time) {
            console.log(`Last plot:        ${new Date(dbRow.last_plot_time).toISOString()}`);
          }

          // Deadline remaining (72h from last plot)
          if (dbRow.has_deadline && dbRow.last_plot_time && !dbRow.sunset) {
            const DEADLINE_HOURS = 72;
            const deadlineMs =
              new Date(dbRow.last_plot_time).getTime() + DEADLINE_HOURS * 60 * 60 * 1000;
            const remainingMs = deadlineMs - Date.now();
            if (remainingMs <= 0) {
              console.log(`Deadline:         expired`);
            } else {
              const totalMin = Math.floor(remainingMs / 60_000);
              const days = Math.floor(totalMin / 1440);
              const hours = Math.floor((totalMin % 1440) / 60);
              const mins = totalMin % 60;
              const parts: string[] = [];
              if (days > 0) parts.push(`${days}d`);
              if (hours > 0) parts.push(`${hours}h`);
              if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
              console.log(`Deadline:         ${parts.join(" ")} remaining`);
            }
          }
        }

        if (tokenPrice) {
          console.log(`Token price:      ${tokenPrice.priceFormatted} ${tokenSymbol}`);
        }

        if (unclaimedRoyalty !== null && unclaimedRoyalty > 0n) {
          console.log(`Unclaimed royalty: ${formatUnits(unclaimedRoyalty, tokenDecimals)} ${tokenSymbol}`);
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
