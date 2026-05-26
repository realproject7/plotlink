import { NextResponse } from "next/server";
import { verifySiweRequest } from "../../../../../lib/airdrop/siwe-verify";
import { createServerClient } from "../../../../../lib/supabase";

export async function POST(req: Request) {
  let message: string, signature: string;
  try {
    const body = await req.json();
    message = body.message;
    signature = body.signature;
    if (!message || !signature) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const auth = await verifySiweRequest(message, signature);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const address = auth.address;
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("pl_activations")
    .select("x_handle_confirmed_at, x_follow_at, activated_at")
    .eq("address", address)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Must confirm X handle first" }, { status: 400 });
  }

  const handleConfirmed = existing.x_handle_confirmed_at !== null;
  const alreadyActivated = existing.activated_at !== null;

  const { error } = await supabase
    .from("pl_activations")
    .update({
      x_follow_at: now,
      ...(handleConfirmed && !alreadyActivated ? { activated_at: now } : {}),
    })
    .eq("address", address);

  if (error) {
    console.error("[x-follow-click] Update failed:", error.message);
    return NextResponse.json({ error: "Failed to record follow" }, { status: 500 });
  }

  return NextResponse.json({
    address,
    x_follow_at: now,
    activated: handleConfirmed && !alreadyActivated ? true : alreadyActivated,
  });
}
