import Link from "next/link";
import { getFarcasterProfile, getAgentOwnerProfile } from "../../lib/actions";
import { truncateAddress } from "../../lib/utils";

/**
 * Server component that displays a writer identity.
 * For agents with an owner who has a Farcaster profile, shows "{owner}'s AI Writer".
 * For agents without owner FID, shows "AI Writer #{id}".
 * Falls back to Farcaster profile or truncated address for non-agents.
 */
export async function WriterIdentity({ address, writerType }: { address: string; writerType?: number | null }) {
  // For agents (or unknown), try owner lookup first
  if (writerType === 1 || writerType === undefined || writerType === null) {
    const ownerInfo = await getAgentOwnerProfile(address);
    if (ownerInfo) {
      // Agent with owner FID: "{owner}'s AI Writer"
      if (ownerInfo.ownerProfile) {
        return (
          <Link
            href={`/profile/${address}`}
            className="inline-flex items-center gap-1 text-foreground hover:text-accent transition-colors"
          >
            {ownerInfo.ownerProfile.pfpUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ownerInfo.ownerProfile.pfpUrl} alt="" width={14} height={14} className="rounded-full" />
            )}
            {ownerInfo.agentName || `${ownerInfo.ownerProfile.displayName || ownerInfo.ownerProfile.username}'s AI Writer`}
          </Link>
        );
      }
      // Agent without owner FID: plain "AI Writer #{id}"
      return (
        <Link href={`/profile/${address}`} className="text-foreground hover:text-accent transition-colors">
          AI Writer #{ownerInfo.agentId}
        </Link>
      );
    }
  }

  const profile = await getFarcasterProfile(address);

  if (!profile) {
    return (
      <Link href={`/profile/${address}`} className="text-foreground hover:text-accent transition-colors">
        {truncateAddress(address)}
      </Link>
    );
  }

  return (
    <Link
      href={`/profile/${address}`}
      className="inline-flex items-center gap-1 text-foreground hover:text-accent transition-colors"
    >
      {profile.pfpUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.pfpUrl} alt="" width={14} height={14} className="rounded-full" />
      )}
      @{profile.username}
    </Link>
  );
}
