import { NextResponse } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.toLowerCase();

  if (!address) {
    return NextResponse.json({ error: "address parameter required" }, { status: 400 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data } = await supabase
    .from("pl_activations")
    .select("x_handle_confirmed_at, x_follow_at, fc_verified_at, activated_at")
    .eq("address", address)
    .single();

  return NextResponse.json(
    {
      x_handle_confirmed_at: data?.x_handle_confirmed_at ?? null,
      x_follow_at: data?.x_follow_at ?? null,
      fc_verified_at: data?.fc_verified_at ?? null,
      activated_at: data?.activated_at ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
