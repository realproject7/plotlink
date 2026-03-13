import { NextResponse } from "next/server";
import { type Hex, decodeEventLog, encodeEventTopics } from "viem";
import { publicClient } from "../../../../../lib/viem";
import { createServerClient } from "../../../../../lib/supabase";
import {
  storyFactoryAbi,
  storylineCreatedEvent,
} from "../../../../../lib/contracts/abi";
import { detectWriterType } from "../../../../../lib/contracts/erc8004";
import type { Database } from "../../../../../lib/supabase";

/** StorylineCreated event topic0 */
const STORYLINE_CREATED_TOPIC = encodeEventTopics({
  abi: [storylineCreatedEvent],
  eventName: "StorylineCreated",
})[0];

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const body = await req.json();
  const txHash = body.txHash as Hex | undefined;

  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return error("Missing or invalid txHash");
  }

  // 1. Fetch receipt
  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  } catch {
    return error("Failed to fetch transaction receipt", 502);
  }

  if (receipt.status !== "success") {
    return error("Transaction failed");
  }

  // 2. Find StorylineCreated event log by event signature (topic0)
  const storylineLog = receipt.logs.find(
    (log) => log.topics[0] === STORYLINE_CREATED_TOPIC
  );

  if (!storylineLog) {
    return error("StorylineCreated event not found in receipt");
  }

  // 3. Decode event
  let decoded;
  try {
    decoded = decodeEventLog({
      abi: storyFactoryAbi,
      data: storylineLog.data,
      topics: storylineLog.topics,
    });
  } catch {
    return error("Failed to decode StorylineCreated event");
  }

  if (decoded.eventName !== "StorylineCreated") {
    return error("Unexpected event type");
  }

  const { storylineId, writer, tokenAddress, title, hasDeadline } =
    decoded.args;

  // 4. Get block timestamp
  let blockTimestamp: bigint;
  try {
    const block = await publicClient.getBlock({
      blockNumber: receipt.blockNumber,
    });
    blockTimestamp = block.timestamp;
  } catch {
    return error("Failed to fetch block", 502);
  }

  // 5. Detect writer type via ERC-8004 (best-effort, defaults to human)
  const writerType = await detectWriterType(writer);

  // 6. Upsert to Supabase
  const supabase = createServerClient();
  if (!supabase) {
    return error("Supabase not configured", 500);
  }

  const row: Database["public"]["Tables"]["storylines"]["Insert"] = {
    storyline_id: Number(storylineId),
    writer_address: writer.toLowerCase(),
    token_address: tokenAddress.toLowerCase(),
    title,
    plot_count: 1, // genesis plot
    has_deadline: hasDeadline,
    writer_type: writerType,
    last_plot_time: new Date(Number(blockTimestamp) * 1000).toISOString(),
    block_timestamp: new Date(Number(blockTimestamp) * 1000).toISOString(),
    tx_hash: txHash.toLowerCase(),
    log_index: storylineLog.logIndex!,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (supabase.from("storylines") as any).upsert(
    row,
    { onConflict: "tx_hash,log_index" }
  );

  if (dbError) {
    return error(`Database error: ${dbError.message}`, 500);
  }

  return NextResponse.json({ success: true });
}
