import { NextResponse } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";
import { ZAP_PLOTLINK } from "../../../../../lib/contracts/constants";
import { AIRDROP_CONFIG } from "../../../../../lib/airdrop/config";
import { computeBuyPoints } from "../../../../../lib/airdrop/points";

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

async function handler(req: Request) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.NEXT_PUBLIC_AIRDROP_PAUSED === "1") {
    return NextResponse.json({ paused: true });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const now = new Date();
  if (now > AIRDROP_CONFIG.CAMPAIGN_END) {
    return NextResponse.json({ message: "Campaign ended, no points awarded" });
  }

  const zapAddress = ZAP_PLOTLINK.toLowerCase();

  const { data: trades, error: tradesErr } = await supabase
    .from("trade_history")
    .select("id, user_address, reserve_amount, block_timestamp")
    .eq("event_type", "mint")
    .gte("block_timestamp", AIRDROP_CONFIG.CAMPAIGN_START.toISOString())
    .lte("block_timestamp", AIRDROP_CONFIG.CAMPAIGN_END.toISOString())
    .not("user_address", "is", null);

  if (tradesErr) {
    console.error("[airdrop-points] Failed to fetch trades:", tradesErr.message);
    return NextResponse.json({ error: "Failed to fetch trades" }, { status: 500 });
  }

  if (!trades || trades.length === 0) {
    return NextResponse.json({ message: "No trades to process", processed: 0 });
  }

  const eligible = trades.filter(
    (t) => t.user_address && t.user_address.toLowerCase() !== zapAddress,
  );

  const tradeIds = eligible.map((t) => t.id);
  const { data: existing } = await supabase
    .from("pl_points")
    .select("metadata")
    .eq("action", "buy")
    .in("metadata->>trade_id", tradeIds.map(String));

  const processedTradeIds = new Set(
    (existing ?? [])
      .map((r) => {
        const meta = r.metadata as Record<string, unknown> | null;
        return meta?.trade_id != null ? String(meta.trade_id) : null;
      })
      .filter(Boolean),
  );

  let buyCount = 0;
  const inserts: Array<{
    address: string;
    action: string;
    points: number;
    metadata: Record<string, unknown>;
  }> = [];

  for (const trade of eligible) {
    if (processedTradeIds.has(String(trade.id))) continue;

    const address = trade.user_address!.toLowerCase();
    const buyPoints = computeBuyPoints(trade.reserve_amount, 0);
    inserts.push({
      address,
      action: "buy",
      points: buyPoints,
      metadata: { trade_id: trade.id },
    });
    buyCount++;
  }

  if (inserts.length > 0) {
    const { error: insertErr } = await supabase.from("pl_points").insert(inserts);
    if (insertErr) {
      console.error("[airdrop-points] Insert failed:", insertErr.message);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }
  }

  console.info(`[airdrop-points] Processed ${buyCount} buys`);
  return NextResponse.json({
    message: "Points synced",
    processed: { buys: buyCount },
  });
}

export async function GET(req: Request) {
  return handler(req);
}

export async function POST(req: Request) {
  return handler(req);
}
