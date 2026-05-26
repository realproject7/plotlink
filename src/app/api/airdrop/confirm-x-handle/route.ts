import { NextResponse } from "next/server";
import { verifySiweRequest } from "../../../../../lib/airdrop/siwe-verify";
import { lookupXUser } from "../../../../../lib/airdrop/twitterapi";
import { createServerClient } from "../../../../../lib/supabase";
import { nanoid } from "nanoid";

export async function POST(req: Request) {
  let message: string, signature: string, username: string;
  try {
    const body = await req.json();
    message = body.message;
    signature = body.signature;
    username = body.username;
    if (!message || !signature || !username) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const auth = await verifySiweRequest(message, signature);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const address = auth.address;
  const handle = username.toLowerCase();

  let xUserId: string | null = null;
  let confirmedAt: string | null = null;

  try {
    const user = await lookupXUser(username);
    if (user) {
      xUserId = user.x_user_id;
      confirmedAt = new Date().toISOString();
    }
  } catch {
    // R16 graceful degrade: twitterapi.io down → pending row without UNIQUE lock
  }

  const { error: upsertErr } = await supabase
    .from("pl_activations")
    .upsert(
      {
        address,
        x_handle: handle,
        x_user_id: xUserId,
        x_handle_confirmed_at: confirmedAt,
      },
      { onConflict: "address" },
    );

  if (upsertErr) {
    if (upsertErr.code === "23505") {
      return NextResponse.json({ error: "X handle already claimed by another wallet" }, { status: 409 });
    }
    console.error("[confirm-x-handle] Upsert failed:", upsertErr.message);
    return NextResponse.json({ error: "Failed to confirm handle" }, { status: 500 });
  }

  const { data: existingCode } = await supabase
    .from("pl_referral_codes")
    .select("code")
    .eq("address", address)
    .limit(1)
    .single();

  if (!existingCode) {
    const code = nanoid(8);
    await supabase.from("pl_referral_codes").insert({
      address,
      code,
      is_farcaster_username: false,
    });
  }

  return NextResponse.json({
    address,
    x_handle: handle,
    confirmed: confirmedAt !== null,
  });
}
