function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function isMobileWithInjectedProvider(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.ethereum) return false;
  return /mobile|android/i.test(navigator.userAgent);
}

export async function isFarcasterMiniApp(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const ctx = await withTimeout(sdk.context, 3000, null);
    return !!ctx;
  } catch {
    return false;
  }
}

export async function detectPlatform(): Promise<"farcaster" | "base" | "web"> {
  if (typeof window === "undefined") return "web";

  // Fast path: mobile browser with injected provider is Base App
  if (isMobileWithInjectedProvider()) {
    try {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      const ctx = await withTimeout(sdk.context, 1000, null);
      if (ctx?.client) {
        if (ctx.client.clientFid === 309857) return "base";
        return "farcaster";
      }
    } catch {
      // SDK failed — fall through to Base App detection
    }
    return "base";
  }

  // Standard path: desktop or non-injected mobile
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const ctx = await withTimeout(sdk.context, 3000, null);
    if (!ctx?.client) return "web";
    if (ctx.client.clientFid === 309857) return "base";
    return "farcaster";
  } catch {
    return "web";
  }
}
