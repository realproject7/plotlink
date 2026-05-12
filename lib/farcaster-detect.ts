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
  if (isMobileWithInjectedProvider()) return false;
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

  // Base App: mobile + injected provider → skip SDK import entirely
  // Warpcast does NOT inject window.ethereum, so this is a safe distinguisher
  if (isMobileWithInjectedProvider()) {
    return "base";
  }

  // Only import SDK when NOT in Base App (desktop or Warpcast)
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
