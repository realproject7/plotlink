import { lookupByAddress } from "../../lib/farcaster";
import { truncateAddress } from "../../lib/utils";

/**
 * Server component that displays a Farcaster identity (avatar + username)
 * when available, falling back to a truncated Ethereum address.
 */
export async function WriterIdentity({ address }: { address: string }) {
  const profile = await lookupByAddress(address);

  if (!profile) {
    return <span>{truncateAddress(address)}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1">
      {profile.pfpUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.pfpUrl}
          alt=""
          width={14}
          height={14}
          className="rounded-full"
        />
      )}
      <a
        href={`https://farcaster.com/${profile.username}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground hover:text-accent transition-colors"
      >
        @{profile.username}
      </a>
    </span>
  );
}
