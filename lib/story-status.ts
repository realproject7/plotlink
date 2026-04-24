import type { Storyline } from "./supabase";

/** Deadline window in hours — stories expire this long after their last plot. */
export const DEADLINE_HOURS = 168;
export const DEADLINE_MS = DEADLINE_HOURS * 60 * 60 * 1000;

export type StoryStatus = "active" | "completed" | "expired";

/**
 * Determine whether a story is active, completed, or expired.
 *
 * All stories have a 7-day deadline from their last plot — the `has_deadline`
 * DB field is unreliable for older stories indexed before the flag existed.
 * We check deadline expiry for any story with a `last_plot_time`, regardless
 * of `has_deadline`.
 */
export function getStoryStatus(storyline: Pick<Storyline, "sunset" | "has_deadline" | "last_plot_time">): StoryStatus {
  if (storyline.sunset) return "completed";
  if (storyline.last_plot_time) {
    const deadline = new Date(storyline.last_plot_time).getTime() + DEADLINE_MS;
    if (Date.now() > deadline) return "expired";
  }
  return "active";
}
