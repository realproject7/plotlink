export const REFERRAL_STORAGE_KEY = "plotlink_ref";

export async function handleInboundReferral(
  message: string,
  signature: string,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const refCode = typeof localStorage !== "undefined"
    ? localStorage.getItem(REFERRAL_STORAGE_KEY)
    : null;
  if (!refCode) return;

  try {
    const res = await fetchFn("/api/airdrop/register-referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, signature, referralCode: refCode }),
    });
    if (res.ok || res.status === 400 || res.status === 404 || res.status === 409) {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
    }
  } catch {
    // transient error — keep localStorage for retry
  }
}
