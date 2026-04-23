import type { Storyline } from "./supabase";

/** Deadline window in hours — stories expire this long after their last plot. */
export const DEADLINE_HOURS = 168;
export const DEADLINE_MS = DEADLINE_HOURS * 60 * 60 * 1000;

export type StoryStatus = "active" | "completed" | "expired";

/** Determine whether a story is active, completed, or expired. */
export function getStoryStatus(storyline: Pick<Storyline, "sunset" | "has_deadline" | "last_plot_time">): StoryStatus {
  if (storyline.sunset) return "completed";
  if (storyline.has_deadline && storyline.last_plot_time) {
    const deadline = new Date(storyline.last_plot_time).getTime() + DEADLINE_MS;
    if (Date.now() > deadline) return "expired";
  }
  return "active";
}
