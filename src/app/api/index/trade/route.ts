import { NextResponse } from "next/server";
import { type Hex, decodeEventLog, formatUnits } from "viem";
import { publicClient, getReceiptWithRetry } from "../../../../../lib/rpc";
import { createServerClient } from "../../../../../lib/supabase";
import { mcv2BondEventAbi, priceForNextMintFunction } from "../../../../../lib/contracts/abi";
import { MCV2_BOND, ZAP_PLOTLINK } from "../../../../../lib/contracts/constants";
import { erc20Abi } from "../../../../../lib/price";
import type { Database } from "../../../../../lib/supabase";

type TradeInsert = Database["public"]["Tables"]["trade_history"]["Insert"];

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const body = await req.json();
  const txHash = body.txHash as Hex | undefined;
  const tokenAddress = (body.tokenAddress as string | undefined)?.toLowerCase();

  if (!txHash) return error("txHash required");
  if (!tokenAddress) return error("tokenAddress required");

  const supabase = createServerClient();
  if (!supabase) return error("Supabase not configured", 500);

  // Look up storyline for this token
  const { data: storyline } = await supabase
    .from("storylines")
    .select("storyline_id")
    .eq("token_address", tokenAddress)
    .single();

  if (!storyline) return error("Unknown token address", 404);

  const receipt = await getReceiptWithRetry(txHash);
  if (!receipt) return error("Receipt not found", 404);

  // Retry getBlock — RPC may not have the block yet on load-balanced nodes
  let timestampISO: string;
  for (let attempt = 1; ; attempt++) {
    try {
      const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
      timestampISO = new Date(Number(block.timestamp) * 1000).toISOString();
      break;
    } catch (err) {
      if (attempt >= 5) throw err;
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }

  let indexed = 0;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== MCV2_BOND.toLowerCase()) continue;

    try {
      const decoded = decodeEventLog({
        abi: mcv2BondEventAbi,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName !== "Mint" && decoded.eventName !== "Burn") continue;

      const args = decoded.args as {
        token: `0x${string}`;
        user: `0x${string}`;
        receiver: `0x${string}`;
        amountMinted?: bigint;
        amountBurned?: bigint;
        reserveAmount?: bigint;
        refundAmount?: bigint;
      };

      if (args.token.toLowerCase() !== tokenAddress) continue;

      // Skip intermediate Zap self-mints (HUNT→PLOT conversion where receiver is the Zap contract)
      if (args.receiver.toLowerCase() === ZAP_PLOTLINK.toLowerCase()) continue;

      const isMint = decoded.eventName === "Mint";
      const reserveAmount = isMint ? args.reserveAmount! : args.refundAmount!;
      const tokenAmount = isMint ? args.amountMinted! : args.amountBurned!;

      // Marginal price from bonding curve (not batch average)
      let pricePerToken = 0;
      try {
        const price = await publicClient.readContract({
          address: MCV2_BOND as `0x${string}`,
          abi: [priceForNextMintFunction],
          functionName: "priceForNextMint",
          args: [args.token],
          blockNumber: receipt.blockNumber,
        });
        pricePerToken = Number(formatUnits(price, 18));
      } catch {
        // Fallback to batch average if RPC call fails
        pricePerToken = tokenAmount > BigInt(0)
          ? Number(formatUnits(reserveAmount, 18)) /
            Number(formatUnits(tokenAmount, 18))
          : 0;
      }

      let totalSupply = BigInt(0);
      try {
        totalSupply = await publicClient.readContract({
          address: args.token,
          abi: erc20Abi,
          functionName: "totalSupply",
          blockNumber: receipt.blockNumber,
        });
      } catch {
        // Fall back to 0
      }

      const row: TradeInsert = {
        token_address: tokenAddress,
        storyline_id: storyline.storyline_id,
        event_type: isMint ? "mint" : "burn",
        price_per_token: pricePerToken,
        total_supply: Number(formatUnits(totalSupply, 18)),
        reserve_amount: Number(formatUnits(reserveAmount, 18)),
        block_number: Number(receipt.blockNumber),
        block_timestamp: timestampISO,
        tx_hash: txHash.toLowerCase(),
        log_index: log.logIndex!,
        contract_address: MCV2_BOND.toLowerCase(),
        user_address: args.receiver.toLowerCase(),
      };

      const { error: dbError } = await supabase
        .from("trade_history")
        .upsert(row, { onConflict: "tx_hash,log_index" });
      if (dbError) {
        console.error(`Trade index DB error: ${dbError.message}`);
      } else {
        indexed++;
      }
    } catch {
      // Skip non-matching events
    }
  }

  return NextResponse.json({ indexed });
}
