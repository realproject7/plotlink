/**
 * Merkle proof for airdrop claim (#894)
 * GET /api/airdrop/proof?address=0x...
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "../../../../../lib/supabase";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const address = req.nextUrl.searchParams.get("address")?.toLowerCase();
  if (!address) {
    return NextResponse.json({ error: "Missing address param" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pl_airdrop_proofs" as never)
    .select("amount, proof, merkle_root")
    .eq("address" as never, address)
    .single() as { data: { amount: string; proof: string; merkle_root: string } | null; error: unknown };

  if (error || !data) {
    return NextResponse.json({ eligible: false, amount: null, proof: null, claimed: false });
  }

  return NextResponse.json({
    eligible: true,
    amount: data.amount,
    proof: JSON.parse(data.proof),
    merkleRoot: data.merkle_root,
    claimed: false, // On-chain claim status checked client-side via contract read
  });
}
