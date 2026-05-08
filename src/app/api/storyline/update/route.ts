import { NextResponse } from "next/server";
import { recoverMessageAddress } from "viem";
import { createServerClient } from "../../../../../lib/supabase";
import { STORY_FACTORY } from "../../../../../lib/contracts/constants";
import { GENRES, LANGUAGES } from "../../../../../lib/genres";
import type { Database } from "../../../../../lib/supabase";

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const body = await req.json();
  const {
    storylineId,
    signature,
    message,
  } = body as {
    storylineId?: number;
    coverCid?: string | null;
    genre?: string;
    language?: string;
    isNsfw?: boolean;
    signature?: string;
    message?: string;
  };

  if (!storylineId || !signature || !message) {
    return error("Missing required fields: storylineId, signature, message");
  }

  const msgMatch = message.match(
    /^PlotLink: Update storyline #(\d+)\nTimestamp: (\d+)$/,
  );
  if (!msgMatch) {
    return error("Invalid message format");
  }

  const msgStorylineId = Number(msgMatch[1]);
  const msgTimestamp = Number(msgMatch[2]);

  if (msgStorylineId !== storylineId) {
    return error("Message storylineId mismatch");
  }

  const now = Date.now();
  if (!Number.isFinite(msgTimestamp) || msgTimestamp > now + 30_000) {
    return error("Invalid or future-dated timestamp", 401);
  }
  if (now - msgTimestamp > MAX_TIMESTAMP_AGE_MS) {
    return error("Signature expired (older than 5 minutes)", 401);
  }

  let recoveredAddress: string;
  try {
    recoveredAddress = (
      await recoverMessageAddress({
        message,
        signature: signature as `0x${string}`,
      })
    ).toLowerCase();
  } catch {
    return error("Invalid signature", 401);
  }

  const supabase = createServerClient();
  if (!supabase) {
    return error("Database unavailable", 503);
  }

  const { data: storyline } = await supabase
    .from("storylines")
    .select("writer_address")
    .eq("storyline_id", storylineId)
    .eq("contract_address", STORY_FACTORY.toLowerCase())
    .single();

  if (!storyline) {
    return error("Storyline not found", 404);
  }

  if (storyline.writer_address.toLowerCase() !== recoveredAddress) {
    return error("Signature address does not match storyline author", 401);
  }

  const updates: Partial<Database["public"]["Tables"]["storylines"]["Update"]> =
    {};

  if ("coverCid" in body) {
    const cid = body.coverCid as string | null;
    if (cid !== null && !/^[a-zA-Z0-9]{46,64}$/.test(cid)) {
      return error("Invalid cover CID format");
    }
    updates.cover_cid = cid ?? null;
  }

  if ("genre" in body) {
    const g = body.genre as string;
    if (g && !(GENRES as readonly string[]).includes(g)) {
      return error("Invalid genre");
    }
    updates.genre = g || null;
  }

  if ("language" in body) {
    const l = body.language as string;
    if (!l || !(LANGUAGES as readonly string[]).includes(l)) {
      return error("Invalid language");
    }
    updates.language = l;
  }

  if ("isNsfw" in body) {
    updates.is_nsfw = Boolean(body.isNsfw);
  }

  if (Object.keys(updates).length === 0) {
    return error("No fields to update");
  }

  const { error: dbError } = await supabase
    .from("storylines")
    .update(updates)
    .eq("storyline_id", storylineId)
    .eq("contract_address", STORY_FACTORY.toLowerCase());

  if (dbError) {
    return error(`Database error: ${dbError.message}`, 500);
  }

  return NextResponse.json({ success: true });
}
