import { NextRequest, NextResponse } from "next/server";
import { createServerClient, supabase } from "../../../../lib/supabase";

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ---------------------------------------------------------------------------
// GET /api/views?storylineId=N
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const storylineId = req.nextUrl.searchParams.get("storylineId");
  if (!storylineId) return error("Missing storylineId");

  const db = supabase;
  if (!db) return error("Supabase not configured", 500);

  const sid = Number(storylineId);
  if (isNaN(sid) || sid <= 0) return error("Invalid storylineId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: dbError } = await (db.from("storylines") as any)
    .select("view_count")
    .eq("storyline_id", sid)
    .single();

  if (dbError) return error(`Database error: ${dbError.message}`, 500);
  if (!data) return error("Storyline not found", 404);

  return NextResponse.json({ storylineId: sid, viewCount: data.view_count ?? 0 });
}

// ---------------------------------------------------------------------------
// POST /api/views
// Body: { storylineId, plotIndex?, sessionId, viewerAddress? }
// Dedup: max 1 view per session per page per hour
// ---------------------------------------------------------------------------

interface ViewBody {
  storylineId: number;
  plotIndex?: number | null;
  sessionId: string;
  viewerAddress?: string | null;
}

export async function POST(req: NextRequest) {
  let body: ViewBody;
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body");
  }

  const { storylineId, plotIndex, sessionId, viewerAddress } = body;

  if (!storylineId || typeof storylineId !== "number" || storylineId <= 0) {
    return error("Missing or invalid storylineId");
  }
  if (!sessionId || typeof sessionId !== "string" || sessionId.length > 128) {
    return error("Missing or invalid sessionId");
  }

  const serverClient = createServerClient();
  if (!serverClient) return error("Supabase not configured", 500);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const plotVal = plotIndex ?? null;

  // Dedup: check if this session already viewed this page in the last hour
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dedupQuery = (serverClient.from("page_views") as any)
    .select("id")
    .eq("storyline_id", storylineId)
    .eq("session_id", sessionId)
    .gte("viewed_at", oneHourAgo)
    .limit(1);

  if (plotVal === null) {
    dedupQuery = dedupQuery.is("plot_index", null);
  } else {
    dedupQuery = dedupQuery.eq("plot_index", plotVal);
  }

  const { data: existing } = await dedupQuery;

  if (existing && existing.length > 0) {
    return NextResponse.json({ success: true, deduplicated: true });
  }

  // Insert page view record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (serverClient.from("page_views") as any).insert({
    storyline_id: storylineId,
    plot_index: plotVal,
    viewer_address: viewerAddress?.toLowerCase() ?? null,
    session_id: sessionId,
  });

  if (insertError) return error(`Database error: ${insertError.message}`, 500);

  // Increment denormalized counter (storyline-level views only)
  if (plotVal === null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serverClient.rpc as any)("increment_view_count", { sid: storylineId }).catch(() => {
      // Ignore — counter will be slightly behind but page_views table is authoritative
    });
  }

  return NextResponse.json({ success: true, deduplicated: false });
}
