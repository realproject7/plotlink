import { createServerClient } from "./supabase";

/**
 * DB-based rate limiter (serverless-safe, atomic).
 * Uses a Supabase RPC function that counts + inserts in a single transaction.
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

  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_max_requests: maxRequests,
    p_window_ms: windowMs,
  });

  if (error) return true; // fail open on error
  return data as boolean;
}

/** Extract client IP from request headers (Vercel x-forwarded-for). */
export function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
