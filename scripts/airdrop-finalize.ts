#!/usr/bin/env npx tsx
/**
 * Airdrop finalize script (#893)
 *
 * 1. Compute 7-day TWAP from pl_daily_prices
 * 2. Determine milestone tier
 * 3. Calculate per-user distribution
 * 4. Generate Merkle tree + proofs
 * 5. Output root hash + proof JSON for claim contract deployment
 *
 * Usage:
 *   npx tsx scripts/airdrop-finalize.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { parseUnits } from "viem";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { writeFileSync } from "fs";
import { AIRDROP_CONFIG } from "../lib/airdrop/config";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// Step 1: TWAP Calculation
// ---------------------------------------------------------------------------

async function computeTwap(): Promise<number> {
  const endDate = AIRDROP_CONFIG.CAMPAIGN_END;
  const startDate = new Date(endDate.getTime() - 7 * 86400000);

  const { data, error } = await supabase
    .from("pl_daily_prices")
    .select("mcap_usd")
    .gte("recorded_at", startDate.toISOString().slice(0, 10))
    .lte("recorded_at", endDate.toISOString().slice(0, 10));

  if (error) {
    throw new Error(`Failed to fetch daily prices: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error("No daily price entries found for TWAP window");
  }

  const sum = data.reduce((acc, row) => acc + Number(row.mcap_usd), 0);
  const twap = sum / data.length;

  console.log(`TWAP (${data.length} days): $${twap.toLocaleString()}`);
  return twap;
}

// ---------------------------------------------------------------------------
// Step 2: Milestone Determination
// ---------------------------------------------------------------------------

function determineMilestone(twapMcap: number): { tier: string; pct: number } {
  const { MILESTONES } = AIRDROP_CONFIG;

  if (twapMcap >= MILESTONES.DIAMOND.mcap) {
    return { tier: "\uD83D\uDC8E Diamond", pct: MILESTONES.DIAMOND.pct };
  }
  if (twapMcap >= MILESTONES.GOLD.mcap) {
    return { tier: "\uD83E\uDD47 Gold", pct: MILESTONES.GOLD.pct };
  }
  if (twapMcap >= MILESTONES.SILVER.mcap) {
    return { tier: "\uD83E\uDD48 Silver", pct: MILESTONES.SILVER.pct };
  }
  if (twapMcap >= MILESTONES.BRONZE.mcap) {
    return { tier: "\uD83E\uDD49 Bronze", pct: MILESTONES.BRONZE.pct };
  }
  return { tier: "None", pct: 0 };
}

// ---------------------------------------------------------------------------
// Step 3: Distribution Calculation
// ---------------------------------------------------------------------------

async function computeDistribution(
  milestonePct: number,
): Promise<{ address: string; amount: bigint }[]> {
  const { data, error } = await supabase
    .from("pl_points")
    .select("address, points");

  if (error) {
    throw new Error(`Failed to fetch points: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.warn("No points found — distribution is empty");
    return [];
  }

  // Aggregate points by address
  const pointsByAddress = new Map<string, number>();
  let totalPoints = 0;
  for (const row of data) {
    const addr = row.address.toLowerCase();
    pointsByAddress.set(addr, (pointsByAddress.get(addr) ?? 0) + row.points);
    totalPoints += row.points;
  }

  if (totalPoints === 0) {
    console.warn("Total points is zero — distribution is empty");
    return [];
  }

  const poolAmount = AIRDROP_CONFIG.POOL_AMOUNT;
  const distributablePlot = poolAmount * (milestonePct / 100);

  console.log(`Pool: ${poolAmount} PLOT, Milestone: ${milestonePct}%, Distributable: ${distributablePlot} PLOT`);
  console.log(`Participants: ${pointsByAddress.size}, Total points: ${totalPoints}`);

  // Exact total in wei
  const totalWei = parseUnits(distributablePlot.toString(), 18);

  // Compute floor amounts and track remainders for largest-remainder allocation
  // Pure bigint arithmetic to avoid Number precision loss
  const totalPointsBig = BigInt(Math.round(totalPoints * 1e6));
  const entries: { address: string; floor: bigint; remainderBig: bigint }[] = [];
  let floorSum = BigInt(0);

  for (const [addr, pts] of pointsByAddress) {
    const ptsBig = BigInt(Math.round(pts * 1e6));
    // floor = (totalWei * pts) / totalPoints  (integer division)
    const floor = (totalWei * ptsBig) / totalPointsBig;
    // remainder = (totalWei * pts) % totalPoints  (for sorting)
    const remainderBig = (totalWei * ptsBig) % totalPointsBig;
    entries.push({ address: addr, floor, remainderBig });
    floorSum += floor;
  }

  // Distribute leftover wei to entries with largest remainders
  let leftover = totalWei - floorSum;
  entries.sort((a, b) => (b.remainderBig > a.remainderBig ? 1 : b.remainderBig < a.remainderBig ? -1 : 0));
  for (const entry of entries) {
    if (leftover <= BigInt(0)) break;
    entry.floor += BigInt(1);
    leftover -= BigInt(1);
  }

  const distribution: { address: string; amount: bigint }[] = entries
    .filter((e) => e.floor > BigInt(0))
    .map((e) => ({ address: e.address, amount: e.floor }));

  // Sort by amount descending for easier verification
  distribution.sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));

  return distribution;
}

// ---------------------------------------------------------------------------
// Step 4: Merkle Tree Generation
// ---------------------------------------------------------------------------

function generateMerkleTree(distribution: { address: string; amount: bigint }[]) {
  if (distribution.length === 0) {
    throw new Error("Cannot generate Merkle tree from empty distribution");
  }

  // StandardMerkleTree expects [address, uint256] leaf encoding
  const values = distribution.map((d) => [d.address, d.amount.toString()]);
  const tree = StandardMerkleTree.of(values, ["address", "uint256"]);

  console.log(`Merkle root: ${tree.root}`);

  // Build proof map
  const proofs: Record<string, { amount: string; proof: string[] }> = {};
  for (const [i, v] of tree.entries()) {
    proofs[v[0] as string] = {
      amount: v[1] as string,
      proof: tree.getProof(i),
    };
  }

  return { root: tree.root, proofs, tree };
}

// ---------------------------------------------------------------------------
// Step 5: Store Results
// ---------------------------------------------------------------------------

async function storeProofs(
  proofs: Record<string, { amount: string; proof: string[] }>,
  root: string,
  tier: string,
  twap: number,
) {
  // Write to JSON file for deployment
  const output = {
    generatedAt: new Date().toISOString(),
    twapMcap: twap,
    milestone: tier,
    merkleRoot: root,
    totalRecipients: Object.keys(proofs).length,
    proofs,
  };

  const outputPath = "scripts/airdrop-proofs.json";
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Proofs written to ${outputPath}`);

  // Also store proofs in DB for the claim API
  const entries = Object.entries(proofs).map(([address, { amount, proof }]) => ({
    address,
    amount,
    proof: JSON.stringify(proof),
    merkle_root: root,
  }));

  // Insert in batches of 100
  for (let i = 0; i < entries.length; i += 100) {
    const batch = entries.slice(i, i + 100);
    const { error } = await supabase.from("pl_airdrop_proofs").upsert(batch, {
      onConflict: "address",
    });
    if (error) {
      console.error(`Failed to store proofs batch ${i}: ${error.message}`);
    }
  }

  console.log(`${entries.length} proofs stored in pl_airdrop_proofs`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== PLOT Airdrop Finalization ===\n");

  // Step 1: TWAP
  const twap = await computeTwap();

  // Step 2: Milestone
  const { tier, pct } = determineMilestone(twap);
  console.log(`\nMilestone: ${tier} (${pct}%)`);

  if (pct === 0) {
    console.log("\nNo milestone reached — all PLOT will be burned.");
    console.log("Burn address: 0x000000000000000000000000000000000000dEaD");
    console.log(`Burn amount: ${AIRDROP_CONFIG.POOL_AMOUNT} PLOT`);
    return;
  }

  // Step 3: Distribution
  const distribution = await computeDistribution(pct);
  if (distribution.length === 0) {
    console.log("\nNo eligible participants.");
    return;
  }

  // Step 4: Merkle tree
  const { root, proofs } = generateMerkleTree(distribution);

  // Step 5: Store
  await storeProofs(proofs, root, tier, twap);

  // Summary
  const burnPct = 100 - pct;
  const burnAmount = AIRDROP_CONFIG.POOL_AMOUNT * (burnPct / 100);
  console.log("\n=== Summary ===");
  console.log(`TWAP MCap: $${twap.toLocaleString()}`);
  console.log(`Milestone: ${tier} (${pct}% distributed)`);
  console.log(`Distribute: ${(AIRDROP_CONFIG.POOL_AMOUNT * pct / 100).toLocaleString()} PLOT to ${distribution.length} addresses`);
  console.log(`Burn: ${burnAmount.toLocaleString()} PLOT (${burnPct}%)`);
  console.log(`Merkle root: ${root}`);
  console.log(`\nNext steps:`);
  console.log(`1. Deploy MerkleClaim contract with root: ${root}`);
  console.log(`2. Unlock PLOT from Mint Club Locker`);
  console.log(`3. Transfer ${(AIRDROP_CONFIG.POOL_AMOUNT * pct / 100).toLocaleString()} PLOT to MerkleClaim contract`);
  console.log(`4. Send ${burnAmount.toLocaleString()} PLOT to 0x000000000000000000000000000000000000dEaD`);
}

main().catch((err) => {
  console.error("Finalization failed:", err);
  process.exit(1);
});
