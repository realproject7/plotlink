import { NextRequest, NextResponse } from "next/server";
import { recoverMessageAddress, type Address } from "viem";
import { publicClient } from "../../../../lib/rpc";
import { createServerClient, supabase } from "../../../../lib/supabase";
import { erc20Abi } from "../../../../lib/price";

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ---------------------------------------------------------------------------
// GET /api/ratings?storylineId=N
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const storylineId = req.nextUrl.searchParams.get("storylineId");
  if (!storylineId) {
    return error("Missing storylineId");
  }

  const db = supabase;
  if (!db) {
    return error("Supabase not configured", 500);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: dbError } = await (db.from("ratings") as any)
    .select("*")
    .eq("storyline_id", Number(storylineId));

  if (dbError) {
    return error(`Database error: ${dbError.message}`, 500);
  }

  const ratings = data ?? [];
  const average =
    ratings.length > 0
      ? ratings.reduce(
          (sum: number, r: { rating: number }) => sum + r.rating,
          0,
        ) / ratings.length
      : 0;

  return NextResponse.json({ ratings, average, count: ratings.length });
}

// ---------------------------------------------------------------------------
// POST /api/ratings
// ---------------------------------------------------------------------------

interface RatingBody {
  storylineId: number;
  rating: number;
  comment?: string;
  signature: string;
  message: string;
}

export async function POST(req: NextRequest) {
  let body: RatingBody;
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body");
  }

  const { storylineId, rating, comment, signature, message } = body;

  // Validate inputs
  if (!storylineId || typeof storylineId !== "number") {
    return error("Missing or invalid storylineId");
  }
  if (!rating || typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return error("Rating must be an integer between 1 and 5");
  }
  if (!signature || !message) {
    return error("Missing signature or message");
  }

  // Validate signed message binds to this specific action
  const expectedMessage = `Rate storyline ${storylineId} with rating ${rating}`;
  if (message !== expectedMessage) {
    return error(
      `Signed message must be exactly: "${expectedMessage}"`,
    );
  }

  // 1. Recover rater address from signature
  let raterAddress: Address;
  try {
    raterAddress = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    return error("Failed to verify signature");
  }

  // 2. Look up storyline → get token_address
  const serverClient = createServerClient();
  if (!serverClient) {
    return error("Supabase not configured", 500);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: storyline, error: slError } = await (serverClient.from("storylines") as any)
    .select("token_address")
    .eq("storyline_id", storylineId)
    .single();

  if (slError || !storyline) {
    return error("Storyline not found", 404);
  }

  const tokenAddress = storyline.token_address as Address;

  // 3. Token gate: balanceOf(rater, tokenAddress) > 0
  try {
    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [raterAddress],
    });

    if (balance === BigInt(0)) {
      return error("Must hold storyline tokens to rate", 403);
    }
  } catch {
    return error("Failed to check token balance", 502);
  }

  // 4. Upsert rating via service role client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertError } = await (serverClient.from("ratings") as any).upsert(
    {
      storyline_id: storylineId,
      rater_address: raterAddress.toLowerCase(),
      rating,
      comment: comment ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "storyline_id,rater_address" },
  );

  if (upsertError) {
    return error(`Database error: ${upsertError.message}`, 500);
  }

  return NextResponse.json({ success: true });
}
