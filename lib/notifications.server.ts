/**
 * [#489] Farcaster notification system for PlotLink.
 *
 * Handles notification token storage (Supabase) and sending push
 * notifications to Farcaster clients via the miniapp notification API.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface NotificationToken {
  fid: number;
  notificationToken: string;
  notificationUrl: string;
}

// ---- Token Management ----

export async function saveUserNotificationToken(
  fid: number,
  token: string,
  url: string,
  clientAppFid?: number,
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase.from("notification_tokens").upsert(
    {
      fid,
      notification_token: token,
      notification_url: url,
      client_app_fid: clientAppFid || null,
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "fid" },
  );

  if (error) {
    console.error("Failed to save notification token:", error);
    throw new Error(`Failed to save notification token: ${error.message}`);
  }
}

export async function disableUserNotifications(fid: number): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("notification_tokens")
    .update({ enabled: false })
    .eq("fid", fid);

  if (error) {
    console.error("Failed to disable notifications:", error);
  }
}

export async function getEnabledTokens(): Promise<NotificationToken[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("notification_tokens")
    .select("*")
    .eq("enabled", true);

  if (error) {
    console.error("Failed to get notification tokens:", error);
    return [];
  }

  return (data || []).map((row) => ({
    fid: row.fid,
    notificationToken: row.notification_token,
    notificationUrl: row.notification_url,
  }));
}

// ---- Notification Sending ----

export async function sendNotification(params: {
  notificationId: string;
  title: string;
  body: string;
  targetUrl: string;
  tokens: NotificationToken[];
}): Promise<{ successful: number; failed: number }> {
  const { notificationId, title, body, targetUrl, tokens } = params;
  const supabase = getSupabase();

  if (tokens.length === 0) return { successful: 0, failed: 0 };

  // Group tokens by notification URL
  const tokensByUrl = new Map<string, string[]>();
  for (const t of tokens) {
    if (!tokensByUrl.has(t.notificationUrl)) {
      tokensByUrl.set(t.notificationUrl, []);
    }
    tokensByUrl.get(t.notificationUrl)!.push(t.notificationToken);
  }

  let successful = 0;
  let failed = 0;

  for (const [url, urlTokens] of tokensByUrl.entries()) {
    // Batch up to 100 tokens per request (Farcaster API limit)
    for (let i = 0; i < urlTokens.length; i += 100) {
      const batch = urlTokens.slice(i, i + 100);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notificationId,
            title,
            body,
            targetUrl,
            tokens: batch,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const invalidBatchTokens =
            result.invalidTokens || result.result?.invalidTokens || [];
          successful += batch.length - invalidBatchTokens.length;

          // Delete invalid tokens
          if (invalidBatchTokens.length > 0) {
            await supabase
              .from("notification_tokens")
              .delete()
              .in("notification_token", invalidBatchTokens);
          }
        } else {
          failed += batch.length;
          console.error(
            `[NOTIFICATION] Failed batch to ${url}: ${response.status}`,
          );
        }
      } catch (error) {
        console.error("Error sending notification batch:", error);
        failed += batch.length;
      }
    }
  }

  return { successful, failed };
}

// ---- PlotLink-Specific Triggers ----

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://plotlink.xyz";

/**
 * Notify all users with enabled notifications about a new plot.
 * Called from the backfill cron when a new plot is indexed.
 */
export async function notifyNewPlot(
  storylineId: number,
  storyTitle: string,
  plotIndex: number,
): Promise<void> {
  const tokens = await getEnabledTokens();
  if (tokens.length === 0) return;

  const label = plotIndex === 0 ? "Genesis" : `Chapter ${plotIndex}`;

  await sendNotification({
    notificationId: `pl-new-plot-${storylineId}-${plotIndex}`,
    title: `New ${label} published`,
    body: `"${storyTitle.slice(0, 40)}" has a new plot on PlotLink`,
    targetUrl: `${appUrl}/story/${storylineId}`,
    tokens,
  });
}
