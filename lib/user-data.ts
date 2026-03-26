/**
 * [#563] Shared helper for building user data objects from SteemHunt/Neynar.
 */

import type { SteemhuntUser } from "./farcaster-indexer";
import type { FarcasterProfile } from "./farcaster";
import type { QuotientUserData } from "./quotient";
import type { Database } from "./supabase";

type UserInsert = Database["public"]["Tables"]["users"]["Insert"];

export function buildUserData(opts: {
  steemhuntUser: SteemhuntUser | null;
  neynarProfile: FarcasterProfile | null;
  verifiedAddresses: string[];
  quotientData: QuotientUserData | null;
}): UserInsert {
  const { steemhuntUser, neynarProfile, verifiedAddresses, quotientData } =
    opts;
  const now = new Date().toISOString();

  const base = {
    verified_addresses: verifiedAddresses,
    steemhunt_fetched_at: now,
    quotient_score: quotientData?.quotientScore ?? null,
    quotient_rank: quotientData?.quotientRank ?? null,
    quotient_labels: quotientData?.contextLabels ?? null,
    quotient_updated_at: quotientData ? now : null,
  };

  if (steemhuntUser) {
    return {
      ...base,
      fid: steemhuntUser.fid,
      username: steemhuntUser.username,
      display_name: steemhuntUser.displayName,
      pfp_url: steemhuntUser.pfpUrl,
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
    };
  }

  return {
    ...base,
    fid: neynarProfile!.fid,
    username: neynarProfile!.username,
    display_name: neynarProfile!.displayName,
    pfp_url: neynarProfile!.pfpUrl,
    bio: neynarProfile!.bio,
  };
}
