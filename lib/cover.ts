export function getCoverUrl(coverCid: string | null | undefined): string | null {
  if (!coverCid) return null;
  return `https://ipfs.filebase.io/ipfs/${coverCid}`;
}
