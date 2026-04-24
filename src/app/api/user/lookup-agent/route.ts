import { NextRequest, NextResponse } from "next/server";
import { type Address } from "viem";
import { publicClient } from "../../../../../lib/rpc";
import { erc8004Abi, resolveAgentURI, fetchTokenOrAgentURI } from "../../../../../lib/contracts/erc8004";
import { ERC8004_REGISTRY } from "../../../../../lib/contracts/constants";

/**
 * GET /api/user/lookup-agent?wallet=0x...
 * Looks up an OWS wallet's agent data via RPC:
 *   1. balanceOf(wallet) — confirm wallet owns an agent NFT
 *   2. tokenOfOwnerByIndex(wallet, 0) — get agent ID
 *   3. tokenURI(agentId) — get full metadata JSON
 *
 * If tokenOfOwnerByIndex is not available, returns found=false
 * with a flag so the frontend can prompt for manual agent ID entry.
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  const manualAgentId = request.nextUrl.searchParams.get("agentId");

  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json(
      { error: "Valid wallet address is required" },
      { status: 400 },
    );
  }

  try {
    // If manual agentId provided, verify ownership and fetch metadata
    if (manualAgentId) {
      const agentId = BigInt(manualAgentId);
      const owner = await publicClient.readContract({
        address: ERC8004_REGISTRY,
        abi: erc8004Abi,
        functionName: "ownerOf",
        args: [agentId],
      });

      if ((owner as string).toLowerCase() !== wallet.toLowerCase()) {
        return NextResponse.json({
          found: false,
          error: "This wallet does not own the specified agent",
        });
      }

      return NextResponse.json(await buildAgentResponse(agentId));
    }

    // Check balance first
    const balance = await publicClient.readContract({
      address: ERC8004_REGISTRY,
      abi: erc8004Abi,
      functionName: "balanceOf",
      args: [wallet as Address],
    });

    if ((balance as bigint) <= BigInt(0)) {
      return NextResponse.json({
        found: false,
        error: "No agent NFT found for this wallet",
      });
    }

    // Try enumerable lookup
    let agentId: bigint;
    try {
      agentId = (await publicClient.readContract({
        address: ERC8004_REGISTRY,
        abi: erc8004Abi,
        functionName: "tokenOfOwnerByIndex",
        args: [wallet as Address, BigInt(0)],
      })) as bigint;
    } catch {
      // tokenOfOwnerByIndex not supported — ask user for manual entry
      return NextResponse.json({
        found: false,
        needsManualId: true,
        error: "Could not auto-detect agent ID. Please enter it manually.",
      });
    }

    return NextResponse.json(await buildAgentResponse(agentId));
  } catch (err) {
    return NextResponse.json(
      { found: false, error: err instanceof Error ? err.message : "RPC lookup failed" },
      { status: 502 },
    );
  }
}

async function buildAgentResponse(agentId: bigint) {
  const uri = await fetchTokenOrAgentURI(agentId);

  if (!uri) {
    return {
      found: true,
      agentId: agentId.toString(),
      name: "Unknown Agent",
      description: "",
    };
  }

  const parsed = await resolveAgentURI(uri);
  return {
    found: true,
    agentId: agentId.toString(),
    name: (parsed.name as string) || "Unknown Agent",
    description: (parsed.description as string) || "",
    genre: (parsed.genre as string) || undefined,
    llmModel: (parsed.llmModel as string) || (parsed.model as string) || undefined,
    registeredAt: (parsed.registeredAt as string) || undefined,
  };
}
