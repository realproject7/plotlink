import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, type Database } from "../../../../../lib/supabase";
import { getUserByWallet } from "../../../../../lib/farcaster-indexer";
import { lookupByAddress } from "../../../../../lib/farcaster";
import { fetchQuotientScore, isQuotientStale } from "../../../../../lib/quotient";

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * POST /api/user/onboard
 * Manual profile refresh. Enforces 5-min cooldown unless forceRefresh=true
 * is within cooldown (returns remaining time).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, forceRefresh } = body;

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

    // Check existing user and cooldown
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .contains("verified_addresses", [normalizedAddress])
      .single();

    if (existingUser?.steemhunt_fetched_at && forceRefresh) {
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

    if (!steemhuntUser && !neynarProfile) {
      return NextResponse.json(
        { error: "No Farcaster account found for this wallet." },
        { status: 404 },
      );
    }

    const fid = steemhuntUser?.fid ?? neynarProfile?.fid;

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

    // Build update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userData: Record<string, any> = steemhuntUser
      ? {
          fid: steemhuntUser.fid,
          username: steemhuntUser.username,
          display_name: steemhuntUser.displayName,
          pfp_url: steemhuntUser.pfpUrl,
          verified_addresses: verifiedAddresses,
          primary_address:
            steemhuntUser.primaryAddress?.toLowerCase() || null,
          bio: steemhuntUser.bio,
          url: steemhuntUser.url,
          location: steemhuntUser.location,
          twitter: steemhuntUser.twitter,
          github: steemhuntUser.github,
          follower_count: steemhuntUser.followersCount || 0,
          following_count: steemhuntUser.followingCount || 0,
          is_pro_subscriber: steemhuntUser.proSubscribed ?? false,
          spam_label: steemhuntUser.spamLabel,
          fc_created_at: steemhuntUser.createdAt || null,
          steemhunt_fetched_at: new Date().toISOString(),
        }
      : {
          fid: neynarProfile!.fid,
          username: neynarProfile!.username,
          display_name: neynarProfile!.displayName,
          pfp_url: neynarProfile!.pfpUrl,
          verified_addresses: verifiedAddresses,
          bio: neynarProfile!.bio,
          steemhunt_fetched_at: new Date().toISOString(),
        };

    // Add Quotient data if refreshed
    if (quotientData) {
      userData.quotient_score = quotientData.quotientScore;
      userData.quotient_rank = quotientData.quotientRank;
      userData.quotient_labels = quotientData.contextLabels;
      userData.quotient_updated_at = new Date().toISOString();
    }

    // Upsert
    if (existingUser) {
      const { data, error } = await supabase
        .from("users")
        .update(userData)
        .eq("fid", userData.fid)
        .select()
        .single();

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
        .insert(userData as Database["public"]["Tables"]["users"]["Insert"])
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
