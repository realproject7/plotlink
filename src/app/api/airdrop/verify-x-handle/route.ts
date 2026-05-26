import { NextResponse } from "next/server";
import { verifySiweRequest } from "../../../../../lib/airdrop/siwe-verify";
import { lookupXUser } from "../../../../../lib/airdrop/twitterapi";

export async function POST(req: Request) {
  let message: string, signature: string, username: string;
  try {
    const body = await req.json();
    message = body.message;
    signature = body.signature;
    username = body.username;
    if (!message || !signature || !username) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const auth = await verifySiweRequest(message, signature);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const user = await lookupXUser(username);
  if (!user) {
    return NextResponse.json({ error: "X user not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}
