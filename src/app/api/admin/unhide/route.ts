import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";

export async function POST(req: NextRequest) {
  // Authenticate with ADMIN_API_KEY
  const authHeader = req.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }

  if (authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: { type: string; id: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, id } = body;

  if (!type || !["storyline", "plot"].includes(type)) {
    return NextResponse.json(
      { error: 'type must be "storyline" or "plot"' },
      { status: 400 },
    );
  }
  if (!id || typeof id !== "number") {
    return NextResponse.json(
      { error: "id must be a number" },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  const table = type === "storyline" ? "storylines" : "plots";
  const idColumn = type === "storyline" ? "storyline_id" : "id";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (supabase.from(table) as any)
    .update({ hidden: false })
    .eq(idColumn, id);

  if (dbError) {
    return NextResponse.json(
      { error: `Database error: ${dbError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, action: "unhide", type, id });
}
