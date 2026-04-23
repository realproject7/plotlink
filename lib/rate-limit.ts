import { createServerClient } from "./supabase";

/**
 * DB-based rate limiter (serverless-safe).
 * Returns true if the request is allowed, false if rate limited.
 */
export async function checkRateLimit(
  ip: string,
  endpoint: string,
  maxRequests = 5,
  windowMs = 60_000,
): Promise<boolean> {
  const supabase = createServerClient();
  if (!supabase) return true; // fail open if DB unavailable

  const key = `${endpoint}:${ip}`;
  const windowStart = new Date(Date.now() - windowMs).toISOString();

  // Count recent requests in window
  const { count } = await supabase
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("key", key)
    .gte("created_at", windowStart);

  if (count !== null && count >= maxRequests) {
    return false;
  }

  // Record this request
  await supabase.from("rate_limits").insert({ key });

  return true;
}

/** Extract client IP from request headers (Vercel x-forwarded-for). */
export function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
