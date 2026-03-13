import { NextResponse } from "next/server";
import { decodeEventLog, type Log } from "viem";
import { publicClient } from "../../../../../lib/viem";
import { createServerClient } from "../../../../../lib/supabase";
import {
  storyFactoryAbi,
  plotChainedEvent,
  storylineCreatedEvent,
  donationEvent,
} from "../../../../../lib/contracts/abi";
import { STORY_FACTORY } from "../../../../../lib/contracts/constants";
import { hashContent } from "../../../../../lib/content";
import { detectWriterType } from "../../../../../lib/contracts/erc8004";
import type { Database } from "../../../../../lib/supabase";

const IPFS_GATEWAY = "https://ipfs.filebase.io/ipfs/";
const IPFS_TIMEOUT_MS = 10_000;

/**
 * How many blocks to scan per cron run (~5 min on Base = ~150 blocks at 2s/block).
 * Slightly over-scan to handle timing variance.
 */
const SCAN_BLOCKS = BigInt(200);

/** Cron authorization — set CRON_SECRET env var to protect this endpoint */
function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured = open (dev mode)
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

async function fetchIPFSContent(cid: string): Promise<string | null> {
  try {
    const res = await fetch(`${IPFS_GATEWAY}${cid}`, {
      signal: AbortSignal.timeout(IPFS_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function getBlockTimestamp(blockNumber: bigint): Promise<string> {
  const block = await publicClient.getBlock({ blockNumber });
  return new Date(Number(block.timestamp) * 1000).toISOString();
}

type PlotInsert = Database["public"]["Tables"]["plots"]["Insert"];
type StorylineInsert = Database["public"]["Tables"]["storylines"]["Insert"];
type DonationInsert = Database["public"]["Tables"]["donations"]["Insert"];

export async function GET(req: Request) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  // Skip if StoryFactory not yet deployed
  if (STORY_FACTORY === "0x0000000000000000000000000000000000000000") {
    return NextResponse.json({
      skipped: true,
      reason: "StoryFactory not deployed yet",
    });
  }

  const currentBlock = await publicClient.getBlockNumber();

  // Read last processed block from persistent cursor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cursor } = await (supabase.from("backfill_cursor") as any)
    .select("last_block")
    .eq("id", 1)
    .single();
  const lastBlock = cursor?.last_block ? BigInt(cursor.last_block) : BigInt(0);

  // Start from the block after last processed, but cap scan range
  const idealFrom = lastBlock > BigInt(0) ? lastBlock + BigInt(1) : BigInt(0);
  const maxFrom = currentBlock > SCAN_BLOCKS ? currentBlock - SCAN_BLOCKS : BigInt(0);
  const fromBlock = idealFrom > maxFrom ? maxFrom : idealFrom;

  if (fromBlock > currentBlock) {
    return NextResponse.json({ skipped: true, reason: "Already up to date" });
  }

  // Fetch all StoryFactory logs in the scan range
  const logs = await publicClient.getLogs({
    address: STORY_FACTORY,
    fromBlock,
    toBlock: currentBlock,
  });

  let storylinesInserted = 0;
  let plotsInserted = 0;
  let donationsInserted = 0;
  let errors = 0;

  // Cache block timestamps to avoid redundant RPC calls
  const blockTimestampCache = new Map<bigint, string>();
  async function getCachedBlockTimestamp(blockNumber: bigint): Promise<string> {
    const cached = blockTimestampCache.get(blockNumber);
    if (cached) return cached;
    const ts = await getBlockTimestamp(blockNumber);
    blockTimestampCache.set(blockNumber, ts);
    return ts;
  }

  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: storyFactoryAbi,
        data: log.data,
        topics: log.topics,
      });

      const txHash = log.transactionHash!.toLowerCase();
      const logIndex = log.logIndex!;

      if (decoded.eventName === "StorylineCreated") {
        await processStorylineCreated(
          decoded,
          log,
          txHash,
          logIndex,
          supabase,
          getCachedBlockTimestamp
        );
        storylinesInserted++;
      } else if (decoded.eventName === "PlotChained") {
        await processPlotChained(
          decoded,
          log,
          txHash,
          logIndex,
          supabase,
          getCachedBlockTimestamp
        );
        plotsInserted++;
      } else if (decoded.eventName === "Donation") {
        await processDonation(
          decoded,
          log,
          txHash,
          logIndex,
          supabase,
          getCachedBlockTimestamp
        );
        donationsInserted++;
      }
    } catch {
      errors++;
    }
  }

  // Persist cursor — advance to currentBlock
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("backfill_cursor") as any)
    .update({ last_block: Number(currentBlock), updated_at: new Date().toISOString() })
    .eq("id", 1);

  return NextResponse.json({
    scanned: { fromBlock: Number(fromBlock), toBlock: Number(currentBlock) },
    upserted: {
      storylines: storylinesInserted,
      plots: plotsInserted,
      donations: donationsInserted,
    },
    errors,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DecodedEvent = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

async function processStorylineCreated(
  decoded: DecodedEvent,
  log: Log,
  txHash: string,
  logIndex: number,
  supabase: SupabaseClient,
  getTimestamp: (blockNumber: bigint) => Promise<string>
) {
  const {
    storylineId,
    writer,
    tokenAddress,
    title,
    hasDeadline,
    openingCID,
    openingHash,
  } = decoded.args;

  const timestampISO = await getTimestamp(log.blockNumber!);
  const writerType = await detectWriterType(writer);

  const storylineRow: StorylineInsert = {
    storyline_id: Number(storylineId),
    writer_address: writer.toLowerCase(),
    token_address: tokenAddress.toLowerCase(),
    title,
    plot_count: 1,
    has_deadline: hasDeadline,
    writer_type: writerType,
    last_plot_time: timestampISO,
    block_timestamp: timestampISO,
    tx_hash: txHash,
    log_index: logIndex,
  };

  await supabase
    .from("storylines")
    .upsert(storylineRow, { onConflict: "tx_hash,log_index" });

  // Insert genesis plot
  const content = await fetchIPFSContent(openingCID);
  if (content !== null && hashContent(content) === openingHash) {
    const plotRow: PlotInsert = {
      storyline_id: Number(storylineId),
      plot_index: 0,
      writer_address: writer.toLowerCase(),
      content,
      content_cid: openingCID,
      content_hash: openingHash as string,
      block_timestamp: timestampISO,
      tx_hash: txHash,
      log_index: logIndex,
    };
    await supabase
      .from("plots")
      .upsert(plotRow, { onConflict: "tx_hash,log_index" });
  }
}

async function processPlotChained(
  decoded: DecodedEvent,
  log: Log,
  txHash: string,
  logIndex: number,
  supabase: SupabaseClient,
  getTimestamp: (blockNumber: bigint) => Promise<string>
) {
  const { storylineId, plotIndex, writer, contentCID, contentHash } =
    decoded.args;

  const content = await fetchIPFSContent(contentCID);
  if (content === null) return; // skip if content unavailable
  if (hashContent(content) !== contentHash) return; // skip if hash mismatch

  const timestampISO = await getTimestamp(log.blockNumber!);

  const row: PlotInsert = {
    storyline_id: Number(storylineId),
    plot_index: Number(plotIndex),
    writer_address: writer.toLowerCase(),
    content,
    content_cid: contentCID,
    content_hash: contentHash as string,
    block_timestamp: timestampISO,
    tx_hash: txHash,
    log_index: logIndex,
  };

  await supabase
    .from("plots")
    .upsert(row, { onConflict: "tx_hash,log_index" });
}

async function processDonation(
  decoded: DecodedEvent,
  log: Log,
  txHash: string,
  logIndex: number,
  supabase: SupabaseClient,
  getTimestamp: (blockNumber: bigint) => Promise<string>
) {
  const { storylineId, donor, amount } = decoded.args;
  const timestampISO = await getTimestamp(log.blockNumber!);

  const row: DonationInsert = {
    storyline_id: Number(storylineId),
    donor_address: donor.toLowerCase(),
    amount: amount.toString(),
    block_timestamp: timestampISO,
    tx_hash: txHash,
    log_index: logIndex,
  };

  await supabase
    .from("donations")
    .upsert(row, { onConflict: "tx_hash,log_index" });
}
