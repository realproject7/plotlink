/**
 * Referral code endpoint (#883)
 *
 * GET  /api/airdrop/referral-code?address=0x...  — fetch existing code (no creation)
 * POST /api/airdrop/referral-code                — generate or retrieve code
 * Body: { message: string, signature: string, useFarcasterUsername?: boolean }
 */

import { NextResponse, type NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { createServerClient } from "../../../../../lib/supabase";
import { verifyWalletOwnership } from "../../../../../lib/airdrop/verify-wallet";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const address = req.nextUrl.searchParams.get("address")?.toLowerCase();
  if (!address) {
    return NextResponse.json({ error: "Missing address param" }, { status: 400 });
  }

  const { data } = await supabase
    .from("pl_referral_codes")
    .select("code, is_farcaster_username")
    .eq("address", address)
    .single();

  if (!data) {
    return NextResponse.json({ code: null });
  }

  return NextResponse.json({ code: data.code, is_farcaster_username: data.is_farcaster_username });
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  let message: string;
  let signature: `0x${string}`;
  let useFarcasterUsername: boolean;
  try {
    const body = await req.json();
    message = body.message;
    signature = body.signature;
    useFarcasterUsername = body.useFarcasterUsername === true;
    if (!message || !signature) throw new Error("missing fields");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const address = await verifyWalletOwnership(message, signature);
  if (!address) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Check for existing code (immutable once set)
  const { data: existing } = await supabase
    .from("pl_referral_codes")
    .select("code, is_farcaster_username")
    .eq("address", address)
    .single();

  if (existing) {
    return NextResponse.json({ code: existing.code, is_farcaster_username: existing.is_farcaster_username });
  }

  let code: string;
  let isFarcasterUsername = false;

  if (useFarcasterUsername) {
    // Look up Farcaster username via users table
    const { data: user } = await supabase
      .from("users")
      .select("username, fid")
      .or(`primary_address.ilike.${address},custody_address.ilike.${address}`)
      .not("fid", "is", null)
      .single();

    if (!user?.username) {
      return NextResponse.json({ error: "No Farcaster account found for this wallet" }, { status: 400 });
    }

    // Check if username is already taken as a code by another wallet
    const { data: taken } = await supabase
      .from("pl_referral_codes")
      .select("address")
      .eq("code", user.username)
      .single();

    if (taken) {
      return NextResponse.json({ error: "Farcaster username already in use as referral code" }, { status: 409 });
    }

    code = user.username;
    isFarcasterUsername = true;
  } else {
    code = nanoid(8);
  }

  const { error } = await supabase.from("pl_referral_codes").insert({
    address,
    code,
    is_farcaster_username: isFarcasterUsername,
  });

  if (error) {
    // Handle race condition — another request may have inserted first
    if (error.code === "23505") {
      const { data: retry } = await supabase
        .from("pl_referral_codes")
        .select("code, is_farcaster_username")
        .eq("address", address)
        .single();
      if (retry) {
        return NextResponse.json({ code: retry.code, is_farcaster_username: retry.is_farcaster_username });
      }
    }
    console.error("[referral-code] Insert failed:", error.message);
    return NextResponse.json({ error: "Failed to generate code" }, { status: 500 });
  }

  return NextResponse.json({ code, is_farcaster_username: isFarcasterUsername });
}
