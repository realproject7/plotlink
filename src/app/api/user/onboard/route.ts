import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "../../../../../lib/supabase";
import { getUserByWallet } from "../../../../../lib/farcaster-indexer";
import { lookupByAddress } from "../../../../../lib/farcaster";
import { fetchQuotientScore, isQuotientStale } from "../../../../../lib/quotient";
import { buildUserData } from "../../../../../lib/user-data";

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * POST /api/user/onboard
 * Manual profile refresh. Enforces 5-min cooldown on ALL refreshes.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 },
      );
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 },
      );
    }

    // Check existing user (by verified_addresses or primary_address)
    let existingUser = null;
    const { data: byVerified } = await supabase
      .from("users")
      .select("*")
      .contains("verified_addresses", [normalizedAddress])
      .single();
    if (byVerified) {
      existingUser = byVerified;
    } else {
      const { data: byPrimary } = await supabase
        .from("users")
        .select("*")
        .eq("primary_address", normalizedAddress)
        .single();
      existingUser = byPrimary;
    }

    // Enforce 5-min cooldown on ALL refreshes
    if (existingUser?.steemhunt_fetched_at) {
      const age =
        Date.now() -
        new Date(existingUser.steemhunt_fetched_at).getTime();
      if (age < COOLDOWN_MS) {
        const remainingMs = COOLDOWN_MS - age;
        return NextResponse.json(
          {
            error: "Profile refresh on cooldown",
            cooldownRemainingMs: remainingMs,
            cooldownRemainingSeconds: Math.ceil(remainingMs / 1000),
          },
          { status: 429 },
        );
      }
    }

    // Fetch fresh data from SteemHunt
    const steemhuntUser = await getUserByWallet(normalizedAddress);
    let neynarProfile = null;
    if (!steemhuntUser) {
      neynarProfile = await lookupByAddress(normalizedAddress);
    }

    const fid = steemhuntUser?.fid ?? neynarProfile?.fid ?? null;

    // Build verified addresses
    let verifiedAddresses: string[];
    if (steemhuntUser) {
      verifiedAddresses = (steemhuntUser.addresses || []).map(
        (a: string) => a.toLowerCase(),
      );
    } else {
      verifiedAddresses = [normalizedAddress];
    }
    if (!verifiedAddresses.includes(normalizedAddress)) {
      verifiedAddresses.push(normalizedAddress);
    }

    // Refresh Quotient Score if stale
    let quotientData = null;
    if (
      fid &&
      isQuotientStale(existingUser?.quotient_updated_at ?? null)
    ) {
      try {
        quotientData = await fetchQuotientScore(fid);
      } catch {
        // Non-fatal
      }
    }

    const userData = await buildUserData({
      steemhuntUser,
      neynarProfile,
      verifiedAddresses,
      quotientData,
    });

    // Upsert — use fid or primary_address as key
    if (existingUser) {
      const updateQuery = supabase.from("users").update(userData);
      const conditioned =
        userData.fid != null
          ? updateQuery.eq("fid", userData.fid)
          : updateQuery.eq("primary_address", normalizedAddress);
      const { data, error } = await conditioned.select().single();

      if (error) {
        console.error("[onboard] Update error:", error);
        return NextResponse.json(
          { error: "Failed to update user data" },
          { status: 500 },
        );
      }
      return NextResponse.json({ success: true, user: data });
    } else {
      const { data, error } = await supabase
        .from("users")
        .insert(userData)
        .select()
        .single();

      if (error) {
        console.error("[onboard] Insert error:", error);
        return NextResponse.json(
          { error: "Failed to save user data" },
          { status: 500 },
        );
      }
      return NextResponse.json({ success: true, user: data });
    }
  } catch (error) {
    console.error("[onboard] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
