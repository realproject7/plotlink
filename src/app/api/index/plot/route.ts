import { NextResponse } from "next/server";
import { type Hex, decodeEventLog, encodeEventTopics } from "viem";
import { publicClient } from "../../../../../lib/viem";
import { createServerClient } from "../../../../../lib/supabase";
import {
  storyFactoryAbi,
  plotChainedEvent,
} from "../../../../../lib/contracts/abi";
import { hashContent } from "../../../../../lib/content";
import type { Database } from "../../../../../lib/supabase";

const IPFS_GATEWAY = "https://ipfs.filebase.io/ipfs/";
const IPFS_TIMEOUT_MS = 10_000;

/** PlotChained event topic0 (keccak256 of the event signature) */
const PLOT_CHAINED_TOPIC = encodeEventTopics({
  abi: [plotChainedEvent],
  eventName: "PlotChained",
})[0];

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const body = await req.json();
  const txHash = body.txHash as Hex | undefined;
  const fallbackContent = body.content as string | undefined;

  if (!txHash) {
    return error("Missing txHash");
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

  // 2. Find PlotChained event log by event signature (topic0)
  const plotChainedLog = receipt.logs.find(
    (log) => log.topics[0] === PLOT_CHAINED_TOPIC
  );

  if (!plotChainedLog) {
    return error("PlotChained event not found in receipt");
  }

  // 3. Decode event
  let decoded;
  try {
    decoded = decodeEventLog({
      abi: storyFactoryAbi,
      data: plotChainedLog.data,
      topics: plotChainedLog.topics,
    });
  } catch {
    return error("Failed to decode PlotChained event");
  }

  if (decoded.eventName !== "PlotChained") {
    return error("Unexpected event type");
  }

  const { storylineId, plotIndex, writer, contentCID, contentHash } =
    decoded.args;

  // 4. Fetch content from IPFS (with fallback)
  let content: string;
  try {
    const ipfsRes = await fetch(`${IPFS_GATEWAY}${contentCID}`, {
      signal: AbortSignal.timeout(IPFS_TIMEOUT_MS),
    });
    if (!ipfsRes.ok) throw new Error(`IPFS status ${ipfsRes.status}`);
    content = await ipfsRes.text();
  } catch {
    if (!fallbackContent) {
      return error("IPFS fetch failed and no fallback content provided", 502);
    }
    content = fallbackContent;
  }

  // 5. Verify content hash
  const computedHash = hashContent(content);
  if (computedHash !== contentHash) {
    return error("Content hash mismatch");
  }

  // 6. Get block timestamp
  let blockTimestamp: bigint;
  try {
    const block = await publicClient.getBlock({
      blockNumber: receipt.blockNumber,
    });
    blockTimestamp = block.timestamp;
  } catch {
    return error("Failed to fetch block", 502);
  }

  // 7. Upsert to Supabase
  const supabase = createServerClient();
  if (!supabase) {
    return error("Supabase not configured", 500);
  }

  const row: Database["public"]["Tables"]["plots"]["Insert"] = {
    storyline_id: Number(storylineId),
    plot_index: Number(plotIndex),
    writer_address: writer.toLowerCase(),
    content,
    content_cid: contentCID,
    content_hash: contentHash as string,
    block_timestamp: new Date(Number(blockTimestamp) * 1000).toISOString(),
    tx_hash: txHash.toLowerCase(),
    log_index: plotChainedLog.logIndex!,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (supabase.from("plots") as any).upsert(
    row,
    { onConflict: "tx_hash,log_index" }
  );

  if (dbError) {
    return error(`Database error: ${dbError.message}`, 500);
  }

  return NextResponse.json({ success: true });
}
