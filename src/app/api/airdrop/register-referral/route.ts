/**
 * Referral registration endpoint (#883)
 *
 * POST /api/airdrop/register-referral
 * Body: { address: string, referralCode: string }
 *
 * Records a referral relationship. One referrer per wallet, first-come.
 * No retroactive points — only applies to future buy-points.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";

export async function POST(req: Request) {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  let address: string;
  let referralCode: string;
  try {
    const body = await req.json();
    address = body.address?.toLowerCase();
    referralCode = body.referralCode?.trim();
    if (!address || !referralCode) throw new Error("missing fields");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
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
