import { NextResponse } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";
import { reconcileStorylinePlotCount } from "../../../../../lib/reconcile";
import { STORY_FACTORY } from "../../../../../lib/contracts/constants";

/**
 * One-time reconciliation endpoint: re-counts plot_count for ALL storylines
 * from the plots table. Safe to run multiple times (idempotent).
 *
 * POST /api/cron/reconcile-plots
 */
export async function POST() {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Fetch all storyline IDs
  const { data: storylines, error: fetchError } = await supabase
    .from("storylines")
    .select("storyline_id")
    .eq("contract_address", STORY_FACTORY.toLowerCase());

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!storylines || storylines.length === 0) {
    return NextResponse.json({ reconciled: 0 });
  }

  let reconciled = 0;
  const errors: string[] = [];

  for (const s of storylines) {
    try {
      await reconcileStorylinePlotCount(supabase, s.storyline_id);
      reconciled++;
    } catch (err) {
      errors.push(`storyline ${s.storyline_id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ reconciled, total: storylines.length, errors });
}
