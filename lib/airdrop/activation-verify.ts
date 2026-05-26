const NEYNAR_BASE = "https://api.neynar.com/v2/farcaster";

type VerifyFcResult =
  | { ok: true; fid: number }
  | { ok: false; error: "user_not_found" | "not_following" | "neynar_error" };

export async function verifyFc(
  username: string,
  plotlinkFid: number,
): Promise<VerifyFcResult> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) return { ok: false, error: "neynar_error" };

  let fid: number;
  try {
    const res = await fetch(
      `${NEYNAR_BASE}/user/by_username?username=${encodeURIComponent(username)}`,
      { headers: { accept: "application/json", "x-api-key": apiKey } },
    );

    if (res.status === 404 || res.status === 400) {
      return { ok: false, error: "user_not_found" };
    }
    if (!res.ok) {
      return { ok: false, error: "neynar_error" };
    }

    const data = await res.json();
    fid = data?.user?.fid;
    if (!fid) return { ok: false, error: "user_not_found" };
  } catch {
    return { ok: false, error: "neynar_error" };
  }

  try {
    const res = await fetch(
      `${NEYNAR_BASE}/user/bulk?fids=${plotlinkFid}&viewer_fid=${fid}`,
      { headers: { accept: "application/json", "x-api-key": apiKey } },
    );

    if (!res.ok) {
      return { ok: false, error: "neynar_error" };
    }

    const data = await res.json();
    const target = data?.users?.[0];
    if (!target) return { ok: false, error: "neynar_error" };

    const isFollowing = target?.viewer_context?.following ?? false;
    if (!isFollowing) {
      return { ok: false, error: "not_following" };
    }

    return { ok: true, fid };
  } catch {
    return { ok: false, error: "neynar_error" };
  }
}
