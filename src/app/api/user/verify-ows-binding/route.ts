import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";

/**
 * POST /api/user/verify-ows-binding
 * Verifies that an OWS wallet binding signature is valid.
 *
 * Body: { owsWallet, humanWallet, signature }
 * Message format: "I authorize {humanWallet} as my PlotLink owner. Wallet: {owsWallet}"
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owsWallet, humanWallet, signature } = body;

    if (!owsWallet || !humanWallet || !signature) {
      return NextResponse.json(
        { valid: false, error: "owsWallet, humanWallet, and signature are required" },
        { status: 400 },
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(owsWallet) || !/^0x[a-fA-F0-9]{40}$/.test(humanWallet)) {
      return NextResponse.json(
        { valid: false, error: "Invalid wallet address format" },
        { status: 400 },
      );
    }

    const message = `I authorize ${humanWallet} as my PlotLink owner. Wallet: ${owsWallet}`;

    const valid = await verifyMessage({
      address: owsWallet as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return NextResponse.json(
        { valid: false, error: "Signature does not match the OWS wallet address" },
        { status: 400 },
      );
    }

    return NextResponse.json({ valid: true });
  } catch (err) {
    return NextResponse.json(
      { valid: false, error: err instanceof Error ? err.message : "Verification failed" },
      { status: 500 },
    );
  }
}
