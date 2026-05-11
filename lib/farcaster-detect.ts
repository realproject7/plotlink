function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

/**
 * Detect whether we are running inside a Farcaster Mini App context.
 * Safe to call on server (returns false) and outside Farcaster (returns false).
 */
export async function isFarcasterMiniApp(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const ctx = await withTimeout(sdk.context, 3000);
    return !!ctx;
  } catch {
    return false;
  }
}

export async function detectPlatform(): Promise<"farcaster" | "base" | "web"> {
  if (typeof window === "undefined") return "web";
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const ctx = await withTimeout(sdk.context, 3000);
    if (!ctx?.client) return "web";
    if (ctx.client.clientFid === 309857) return "base";
    return "farcaster";
  } catch {
    return "web";
  }
}
