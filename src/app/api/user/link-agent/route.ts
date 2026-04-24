import { NextRequest, NextResponse } from "next/server";
import { verifyMessage, type Address } from "viem";
import { createServiceRoleClient } from "../../../../../lib/supabase";
import { publicClient } from "../../../../../lib/rpc";
import { erc8004Abi, fetchTokenOrAgentURI, resolveAgentURI } from "../../../../../lib/contracts/erc8004";
import { ERC8004_REGISTRY } from "../../../../../lib/contracts/constants";

/**
 * POST /api/user/link-agent
 * DB-only OWS agent linking: verifies the binding proof and sets
 * linked_agent_wallet on the human's user row.
 *
 * Body: { humanWallet, owsWallet, signature, humanSignature, agentId }
 *   - signature: OWS wallet proves it authorized this human as owner
 *   - humanSignature: Human wallet proves it owns the address
 *   - agentId: from the lookup-agent step (server-verified against chain)
 *
 * Agent metadata is fetched server-side via tokenURI to prevent poisoning.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { humanWallet, owsWallet, signature, humanSignature, agentId } = body;

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
      const { error: insertError } = await supabase.from("users").insert({
        primary_address: normalizedHuman,
        linked_agent_wallet: normalizedOws,
      });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    // Server-side agent metadata verification:
    // If agentId provided, verify ownership on-chain and fetch canonical metadata
    // from tokenURI. Never trust client-supplied name/description/genre.
    const agentFields: {
      agent_owner: string;
      agent_type: string;
      agent_id?: number;
      agent_name?: string;
      agent_description?: string;
      agent_genre?: string;
      agent_llm_model?: string;
      agent_registered_at?: string;
    } = {
      agent_owner: normalizedHuman,
      agent_type: "ows-writer",
    };

    if (agentId) {
      const numericId = BigInt(String(agentId));

      // Fail closed: if agentId is provided, ownership MUST be verified on-chain
      let owner: string;
      try {
        owner = (await publicClient.readContract({
          address: ERC8004_REGISTRY,
          abi: erc8004Abi,
          functionName: "ownerOf",
          args: [numericId],
        })) as string;
      } catch {
        return NextResponse.json(
          { error: "Could not verify agent ownership on-chain. Please try again." },
          { status: 502 },
        );
      }

      if (owner.toLowerCase() !== normalizedOws) {
        return NextResponse.json(
          { error: "OWS wallet does not own the specified agent" },
          { status: 400 },
        );
      }

      agentFields.agent_id = Number(numericId);

      // Fetch canonical metadata from tokenURI — fail if unavailable
      const uri = await fetchTokenOrAgentURI(numericId);
      if (!uri) {
        return NextResponse.json(
          { error: "Could not fetch agent metadata from chain. Please try again." },
          { status: 502 },
        );
      }

      const parsed = await resolveAgentURI(uri);
      if (parsed.name) agentFields.agent_name = parsed.name as string;
      if (parsed.description) agentFields.agent_description = parsed.description as string;
      if (parsed.genre) agentFields.agent_genre = parsed.genre as string;
      if (parsed.llmModel || parsed.model) agentFields.agent_llm_model = (parsed.llmModel || parsed.model) as string;
      if (parsed.registeredAt) agentFields.agent_registered_at = parsed.registeredAt as string;
    }

    // Ensure the OWS wallet has a user row with agent metadata
    const { data: owsUser } = await supabase
      .from("users")
      .select("id")
      .or(`primary_address.eq.${normalizedOws},agent_wallet.eq.${normalizedOws}`)
      .limit(1)
      .single();

    try {
      if (owsUser) {
        await supabase.from("users").update(agentFields).eq("id", owsUser.id);
      } else {
        await supabase.from("users").insert({
          primary_address: normalizedOws,
          agent_wallet: normalizedOws,
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
