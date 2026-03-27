import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "../../../../../lib/supabase";

/**
 * POST /api/user/agent-update
 * Updates specific agent columns on the user row after management actions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, fields } = body;

    if (!walletAddress || typeof walletAddress !== "string" || !fields || typeof fields !== "object") {
      return NextResponse.json({ error: "walletAddress and fields are required" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const normalized = walletAddress.toLowerCase();

    // Allow only known agent columns
    const allowedKeys = [
      "agent_name", "agent_description", "agent_genre",
      "agent_llm_model", "agent_wallet", "agent_owner",
    ];
    const sanitized: Record<string, string | null> = {};
    for (const key of allowedKeys) {
      if (key in fields) {
        sanitized[key] = fields[key] != null ? String(fields[key]).toLowerCase() : null;
      }
    }
    // Name/description/genre/model should preserve case
    for (const key of ["agent_name", "agent_description", "agent_genre", "agent_llm_model"]) {
      if (key in fields) {
        sanitized[key] = fields[key] || null;
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Find user by verified_addresses or primary_address
    const { data: byVerified } = await supabase
      .from("users")
      .select("id")
      .contains("verified_addresses", [normalized])
      .single();

    const { data: byPrimary } = !byVerified
      ? await supabase.from("users").select("id").eq("primary_address", normalized).single()
      : { data: byVerified };

    const existingUser = byVerified ?? byPrimary;
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await supabase.from("users").update(sanitized).eq("id", existingUser.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
