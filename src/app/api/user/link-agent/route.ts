import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { createServiceRoleClient } from "../../../../../lib/supabase";
import { getAgentMetadata } from "../../../../../lib/contracts/erc8004";
import type { Address } from "viem";

/**
 * POST /api/user/link-agent
 * DB-only OWS agent linking: verifies the binding proof and sets
 * linked_agent_wallet on the human's user row. No ERC-8004 involvement
 * on the human side.
 *
 * Body: { humanWallet, owsWallet, signature, humanSignature }
 *   - signature: OWS wallet proves it authorized this human as owner
 *   - humanSignature: Human wallet proves it owns the address (prevents
 *     anyone with the OWS binding sig from linking to an arbitrary wallet)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { humanWallet, owsWallet, signature, humanSignature } = body;

    if (!humanWallet || !owsWallet || !signature || !humanSignature) {
      return NextResponse.json(
        { error: "humanWallet, owsWallet, signature, and humanSignature are required" },
        { status: 400 },
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(humanWallet) || !/^0x[a-fA-F0-9]{40}$/.test(owsWallet)) {
      return NextResponse.json(
        { error: "Invalid wallet address format" },
        { status: 400 },
      );
    }

    // Verify binding proof: OWS wallet signed "I authorize {humanWallet} as my PlotLink owner"
    const owsMessage = `I authorize ${humanWallet} as my PlotLink owner. Wallet: ${owsWallet}`;
    const owsValid = await verifyMessage({
      address: owsWallet as `0x${string}`,
      message: owsMessage,
      signature: signature as `0x${string}`,
    });

    if (!owsValid) {
      return NextResponse.json(
        { error: "OWS binding signature is invalid" },
        { status: 400 },
      );
    }

    // Verify caller owns humanWallet
    const humanMessage = `I am linking OWS wallet ${owsWallet} to my PlotLink account. Wallet: ${humanWallet}`;
    const humanValid = await verifyMessage({
      address: humanWallet as `0x${string}`,
      message: humanMessage,
      signature: humanSignature as `0x${string}`,
    });

    if (!humanValid) {
      return NextResponse.json(
        { error: "Human wallet ownership signature is invalid" },
        { status: 400 },
      );
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const normalizedHuman = humanWallet.toLowerCase();
    const normalizedOws = owsWallet.toLowerCase();

    // Ensure this OWS wallet isn't already linked to another human
    const { data: existingLink } = await supabase
      .from("users")
      .select("id, primary_address")
      .eq("linked_agent_wallet", normalizedOws)
      .single();

    if (existingLink && existingLink.primary_address !== normalizedHuman) {
      return NextResponse.json(
        { error: "This OWS wallet is already linked to another account" },
        { status: 409 },
      );
    }

    // Find human's user row
    const { data: byVerified } = await supabase
      .from("users")
      .select("id")
      .contains("verified_addresses", [normalizedHuman])
      .single();

    const { data: byPrimary } = !byVerified
      ? await supabase.from("users").select("id").eq("primary_address", normalizedHuman).single()
      : { data: byVerified };

    const existingUser = byVerified ?? byPrimary;

    if (existingUser) {
      const { error: updateError } = await supabase
        .from("users")
        .update({ linked_agent_wallet: normalizedOws })
        .eq("id", existingUser.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      // Create minimal user row with the link
      const { error: insertError } = await supabase.from("users").insert({
        primary_address: normalizedHuman,
        linked_agent_wallet: normalizedOws,
      });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    // Ensure the OWS wallet has a user row so its profile page works.
    // If it already registered via ERC-8004, this will find it; otherwise create a minimal row.
    const { data: owsUser } = await supabase
      .from("users")
      .select("id")
      .or(`primary_address.eq.${normalizedOws},agent_wallet.eq.${normalizedOws}`)
      .limit(1)
      .single();

    // Try to fetch ERC-8004 agent metadata for the OWS wallet (best effort)
    let agentFields: Record<string, unknown> = {};
    try {
      const meta = await getAgentMetadata(normalizedOws as Address);
      if (meta?.agentId) {
        agentFields = {
          agent_id: Number(meta.agentId),
          agent_name: meta.name || null,
          agent_description: meta.description || null,
          agent_genre: meta.genre || null,
          agent_registered_at: meta.registeredAt || new Date().toISOString(),
        };
      }
    } catch { /* RPC may fail — proceed without agent metadata */ }

    try {
      if (owsUser) {
        if (Object.keys(agentFields).length > 0) {
          await supabase.from("users").update({
            agent_owner: normalizedHuman,
            agent_type: "ows-writer",
            ...agentFields,
          }).eq("id", owsUser.id);
        }
      } else {
        await supabase.from("users").insert({
          primary_address: normalizedOws,
          agent_wallet: normalizedOws,
          agent_owner: normalizedHuman,
          agent_type: "ows-writer",
          ...agentFields,
        });
      }
    } catch { /* best effort — row creation may conflict */ }

    return NextResponse.json({ ok: true, linkedWallet: normalizedOws });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
