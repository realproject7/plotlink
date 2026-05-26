import { NextResponse } from "next/server";
import { verifySiweRequest } from "../../../../../lib/airdrop/siwe-verify";
import { verifyFc } from "../../../../../lib/airdrop/activation-verify";
import { getAirdropConfig } from "../../../../../lib/airdrop/config";
import { createServerClient } from "../../../../../lib/supabase";

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

  const config = getAirdropConfig();
  const result = await verifyFc(username, config.PLOTLINK_FC_FID);

  if (!result.ok) {
    const statusMap = {
      user_not_found: 404,
      not_following: 422,
      neynar_error: 502,
    } as const;
    return NextResponse.json({ error: result.error }, { status: statusMap[result.error] });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const address = auth.address;
  const now = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from("pl_activations")
    .update({
      fid: result.fid,
      fc_handle: username.toLowerCase(),
      fc_verified_at: now,
    })
    .eq("address", address)
    .select("address")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Farcaster account already linked to another wallet" }, { status: 409 });
    }
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Must confirm X handle first" }, { status: 400 });
    }
    console.error("[verify-fc] Update failed:", error.message);
    return NextResponse.json({ error: "Failed to save FC verification" }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json({ error: "Must confirm X handle first" }, { status: 400 });
  }

  return NextResponse.json({
    address,
    fid: result.fid,
    fc_handle: username.toLowerCase(),
    fc_verified_at: now,
  });
}
