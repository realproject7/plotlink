/**
 * Referral registration endpoint (#883)
 *
 * GET  /api/airdrop/register-referral?address=0x...  — check existing referrer
 * POST /api/airdrop/register-referral                — register referral (SIWE)
 * Body: { message: string, signature: string, referralCode: string }
 *
 * Records a referral relationship. One referrer per wallet, first-come.
 * No retroactive points — only applies to future buy-points.
 */

import { NextResponse, type NextRequest } from "next/server";
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
    .from("pl_referrals")
    .select("referrer_address, referral_code")
    .eq("referred_address", address)
    .single();

  if (!data) {
    return NextResponse.json({ referrer: null });
  }

  // Look up referrer's display name from referral code table
  const { data: codeData } = await supabase
    .from("pl_referral_codes")
    .select("code, is_farcaster_username")
    .eq("address", data.referrer_address)
    .single();

  const displayName = codeData?.is_farcaster_username
    ? `@${codeData.code}`
    : data.referral_code;

  return NextResponse.json({
    referrer: data.referrer_address,
    displayName,
  });
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  let message: string;
  let signature: `0x${string}`;
  let referralCode: string;
  try {
    const body = await req.json();
    message = body.message;
    signature = body.signature;
    referralCode = body.referralCode?.trim();
    if (!message || !signature || !referralCode) throw new Error("missing fields");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const address = await verifyWalletOwnership(message, signature);
  if (!address) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Check if already referred
  const { data: existing } = await supabase
    .from("pl_referrals")
    .select("referrer_address")
    .eq("referred_address", address)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Already referred", referrer: existing.referrer_address }, { status: 409 });
  }

  // Look up referrer by code
  const { data: referrer } = await supabase
    .from("pl_referral_codes")
    .select("address")
    .eq("code", referralCode)
    .single();

  if (!referrer) {
    return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
  }

  // Prevent self-referral
  if (referrer.address.toLowerCase() === address) {
    return NextResponse.json({ error: "Cannot refer yourself" }, { status: 400 });
  }

  const { error } = await supabase.from("pl_referrals").insert({
    referrer_address: referrer.address.toLowerCase(),
    referred_address: address,
    referral_code: referralCode,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already referred" }, { status: 409 });
    }
    console.error("[register-referral] Insert failed:", error.message);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, referrer: referrer.address.toLowerCase() });
}
