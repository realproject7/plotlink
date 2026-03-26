import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, type Database } from "../../../../../lib/supabase";
import { getUserByWallet } from "../../../../../lib/farcaster-indexer";
import { lookupByAddress } from "../../../../../lib/farcaster";
import { fetchQuotientScore } from "../../../../../lib/quotient";

type UserInsert = Database["public"]["Tables"]["users"]["Insert"];

/**
 * POST /api/user/register-by-wallet
 * Called on wallet connect — upserts all Farcaster profile fields.
 * SteemHunt primary (free), Neynar fallback (paid).
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

    // Check if user exists and data is fresh (< 5 min)
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .contains("verified_addresses", [normalizedAddress])
      .single();

    if (existingUser?.steemhunt_fetched_at) {
      const age =
        Date.now() - new Date(existingUser.steemhunt_fetched_at).getTime();
      if (age < 5 * 60 * 1000) {
        return NextResponse.json({ success: true, user: existingUser });
      }
    }

    // SteemHunt lookup (primary, free)
    const steemhuntUser = await getUserByWallet(normalizedAddress);

    // Neynar fallback
    let neynarProfile = null;
    if (!steemhuntUser) {
      neynarProfile = await lookupByAddress(normalizedAddress);
    }

    if (!steemhuntUser && !neynarProfile) {
      return NextResponse.json(
        {
          error:
            "No Farcaster account found for this wallet. Please use a wallet linked to your Farcaster account.",
        },
        { status: 404 },
      );
    }

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

    const fid = steemhuntUser?.fid ?? neynarProfile?.fid;

    // Fetch Quotient Score (non-blocking, don't fail if unavailable)
    let quotientData = null;
    if (fid) {
      try {
        quotientData = await fetchQuotientScore(fid);
      } catch {
        // Non-fatal
      }
    }

    // Build user data
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
          quotient_score: quotientData?.quotientScore ?? null,
          quotient_rank: quotientData?.quotientRank ?? null,
          quotient_labels: quotientData?.contextLabels ?? null,
          quotient_updated_at: quotientData
            ? new Date().toISOString()
            : null,
        }
      : {
          fid: neynarProfile!.fid,
          username: neynarProfile!.username,
          display_name: neynarProfile!.displayName,
          pfp_url: neynarProfile!.pfpUrl,
          verified_addresses: verifiedAddresses,
          bio: neynarProfile!.bio,
          steemhunt_fetched_at: new Date().toISOString(),
          quotient_score: quotientData?.quotientScore ?? null,
          quotient_rank: quotientData?.quotientRank ?? null,
          quotient_labels: quotientData?.contextLabels ?? null,
          quotient_updated_at: quotientData
            ? new Date().toISOString()
            : null,
        };

    // Upsert: INSERT then UPDATE on conflict
    const { data: insertData, error: insertError } = await supabase
      .from("users")
      .insert(userData as UserInsert)
      .select()
      .single();

    let finalData = insertData;

    if (insertError) {
      if (insertError.code === "23505") {
        // Unique violation — update existing
        const { data: updateData, error: updateError } = await supabase
          .from("users")
          .update(userData)
          .eq("fid", userData.fid)
          .select()
          .single();

        if (updateError) {
          console.error("[register-by-wallet] Update error:", updateError);
          return NextResponse.json(
            { error: "Failed to save user data" },
            { status: 500 },
          );
        }
        finalData = updateData;
      } else {
        console.error("[register-by-wallet] Insert error:", insertError);
        return NextResponse.json(
          { error: "Failed to save user data" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true, user: finalData });
  } catch (error) {
    console.error("[register-by-wallet] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
