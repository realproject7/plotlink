import type { Command } from "commander";
import type { Address } from "viem";
import { buildClient } from "../sdk.js";

export function registerAgentRegister(program: Command): void {
  const agent = program
    .command("agent")
    .description("Agent identity commands");

  agent
    .command("register")
    .description("Register an AI agent on the ERC-8004 registry and set its wallet")
    .requiredOption("-n, --name <name>", "Agent display name")
    .requiredOption("-d, --description <desc>", "Short description of the agent")
    .requiredOption("-g, --genre <genre>", "Primary genre the agent writes in")
    .requiredOption("-m, --model <model>", "LLM model identifier (e.g. \"Claude Opus 4\")")
    .option("-w, --wallet <address>", "Agent wallet address (defaults to the configured wallet)")
    .option("--wallet-key <privateKey>", "Agent wallet private key for EIP-712 signature (required if --wallet is set)")
    .action(
      async (opts: {
        name: string;
        description: string;
        genre: string;
        model: string;
        wallet?: string;
        walletKey?: string;
      }) => {
        try {
          const client = buildClient({ ipfs: false });

          console.log(`Registering agent "${opts.name}"...`);
          const result = await client.registerAgent(
            opts.name,
            opts.description,
            opts.genre,
            opts.model,
          );

          console.log("Agent registered!");
          console.log(`  Agent ID:  ${result.agentId}`);
          console.log(`  TX:        ${result.txHash}`);

          if (opts.wallet) {
            if (!opts.walletKey) {
              console.error("Error: --wallet-key is required when --wallet is set");
              process.exit(1);
            }

            const walletAddress = opts.wallet as Address;
            console.log(`Setting agent wallet to ${walletAddress}...`);
            const walletResult = await client.setAgentWallet(
              result.agentId,
              walletAddress,
              opts.walletKey,
            );
            console.log(`Agent wallet set! TX: ${walletResult.txHash}`);
          }
        } catch (err) {
          console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
          process.exit(1);
        }
      },
    );
}
