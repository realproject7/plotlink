#!/usr/bin/env npx tsx
/**
 * Airdrop finalize script (v5)
 *
 * 1. Compute 7-day TWAP from pl_daily_prices
 * 2. Determine milestone tier → released_pool
 * 3. Call weighted_spend helper for per-wallet shares
 * 4. Generate Merkle tree + proofs
 * 5. Output root hash for T6.2 contract deploy
 *
 * Usage:
 *   npx tsx scripts/airdrop-finalize.ts [--dry-run]
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { parseUnits } from "viem";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { writeFileSync } from "fs";
import { getAirdropConfig } from "../lib/airdrop/config";
import { weightedSpendQuery } from "../lib/airdrop/sql";

const dryRun = process.argv.includes("--dry-run");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const config = getAirdropConfig();

async function computeTwap(): Promise<number> {
  const endDate = config.CAMPAIGN_END;
  const startDate = new Date(endDate.getTime() - 7 * 86400000);

  const { data, error } = await supabase
    .from("pl_daily_prices")
    .select("mcap_usd")
    .gte("recorded_at", startDate.toISOString().slice(0, 10))
    .lte("recorded_at", endDate.toISOString().slice(0, 10));

  if (error) throw new Error(`Failed to fetch daily prices: ${error.message}`);
  if (!data || data.length === 0) throw new Error("No daily price entries found for TWAP window");

  const EXPECTED_SAMPLES = 7;
  const MINIMUM_SAMPLES = 5;
  const OVERRIDE_ENV = "AIRDROP_FINALIZE_ALLOW_PARTIAL_TWAP";

  if (data.length < MINIMUM_SAMPLES && process.env[OVERRIDE_ENV] !== "1") {
    throw new Error(
      `TWAP requires >=${MINIMUM_SAMPLES} daily samples, got ${data.length}. ` +
      `Investigate pl_daily_prices cron coverage OR set ${OVERRIDE_ENV}=1 to proceed with partial data.`,
    );
  }
  if (data.length < EXPECTED_SAMPLES) {
    console.warn(`Warning: TWAP using ${data.length} samples (expected ${EXPECTED_SAMPLES}). Verify pl_daily_prices cron coverage.`);
  }

  const sum = data.reduce((acc, row) => acc + Number(row.mcap_usd), 0);
  const twap = sum / data.length;
  console.log(`TWAP (${data.length} days): $${twap.toLocaleString()}`);
  return twap;
}

function determineMilestone(twapMcap: number): { tier: string; pct: number } {
  const { MILESTONES } = config;
  if (twapMcap >= MILESTONES.DIAMOND.mcap) return { tier: "Diamond", pct: MILESTONES.DIAMOND.pct };
  if (twapMcap >= MILESTONES.GOLD.mcap) return { tier: "Gold", pct: MILESTONES.GOLD.pct };
  if (twapMcap >= MILESTONES.SILVER.mcap) return { tier: "Silver", pct: MILESTONES.SILVER.pct };
  if (twapMcap >= MILESTONES.BRONZE.mcap) return { tier: "Bronze", pct: MILESTONES.BRONZE.pct };
  return { tier: "None", pct: 0 };
}

async function fetchWeightedSpend() {
  const { params } = weightedSpendQuery(config);
  const [campStart, campEnd, minThreshold, perRef, cap] = params;

  const { data, error } = await supabase.rpc("weighted_spend", {
    p_campaign_start: String(campStart),
    p_campaign_end: String(campEnd),
    p_min_referral_threshold: Number(minThreshold),
    p_multiplier_per_ref: Number(perRef),
    p_multiplier_cap: Number(cap),
  });

  if (error) throw new Error(`weighted_spend RPC failed: ${error.message}`);
  return (data ?? []) as Array<{
    address: string;
    weighted_spend: number;
    community_total: number;
  }>;
}

function computeDistribution(
  rows: Array<{ address: string; weighted_spend: number; community_total: number }>,
  releasedPool: number,
): { address: string; amount: bigint }[] {
  const communityTotal = Number(rows[0]?.community_total ?? 0);
  if (communityTotal <= 0) return [];

  const totalWei = parseUnits(releasedPool.toString(), 18);
  const totalBig = BigInt(Math.round(communityTotal * 1e6));

  const entries: { address: string; floor: bigint; remainder: bigint }[] = [];
  let floorSum = BigInt(0);

  for (const row of rows) {
    const ws = Number(row.weighted_spend);
    if (ws <= 0) continue;
    const wsBig = BigInt(Math.round(ws * 1e6));
    const floor = (totalWei * wsBig) / totalBig;
    const remainder = (totalWei * wsBig) % totalBig;
    entries.push({ address: row.address, floor, remainder });
    floorSum += floor;
  }

  let leftover = totalWei - floorSum;
  entries.sort((a, b) => (b.remainder > a.remainder ? 1 : b.remainder < a.remainder ? -1 : 0));
  for (const entry of entries) {
    if (leftover <= BigInt(0)) break;
    entry.floor += BigInt(1);
    leftover -= BigInt(1);
  }

  return entries
    .filter(e => e.floor > BigInt(0))
    .map(e => ({ address: e.address, amount: e.floor }))
    .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
}

function generateMerkleTree(distribution: { address: string; amount: bigint }[]) {
  const values = distribution.map(d => [d.address, d.amount.toString()]);
  const tree = StandardMerkleTree.of(values, ["address", "uint256"]);

  const proofs: Record<string, { amount: string; proof: string[] }> = {};
  for (const [i, v] of tree.entries()) {
    proofs[v[0] as string] = { amount: v[1] as string, proof: tree.getProof(i) };
  }

  return { root: tree.root, proofs };
}

async function storeProofs(
  proofs: Record<string, { amount: string; proof: string[] }>,
  root: string,
  tier: string,
  twap: number,
) {
  const output = {
    generatedAt: new Date().toISOString(),
    twapMcap: twap,
    milestone: tier,
    merkleRoot: root,
    totalRecipients: Object.keys(proofs).length,
    proofs,
  };

  writeFileSync("scripts/airdrop-proofs.json", JSON.stringify(output, null, 2));
  console.log("Proofs written to scripts/airdrop-proofs.json");

  if (dryRun) {
    console.log("[DRY RUN] Skipping DB writes");
    return;
  }

  const entries = Object.entries(proofs).map(([address, { amount, proof }]) => ({
    address,
    amount,
    proof: JSON.stringify(proof),
    merkle_root: root,
  }));

  for (let i = 0; i < entries.length; i += 100) {
    const batch = entries.slice(i, i + 100);
    const { error } = await supabase.from("pl_airdrop_proofs").upsert(batch, { onConflict: "address" });
    if (error) throw new Error(`Failed to store proofs batch ${i}: ${error.message}`);
  }

  console.log(`${entries.length} proofs stored in pl_airdrop_proofs`);
}

async function main() {
  console.log(`=== PLOT Airdrop Finalization${dryRun ? " [DRY RUN]" : ""} ===\n`);

  const twap = await computeTwap();
  const { tier, pct } = determineMilestone(twap);
  console.log(`\nMilestone: ${tier} (${pct}%)`);

  if (pct === 0) {
    console.log("\n100% burn, 0 eligible. Sub-Bronze FDV — no Merkle deploy needed.");
    console.log(`Burn amount: ${config.POOL_AMOUNT} PLOT`);
    return;
  }

  const releasedPool = config.POOL_AMOUNT * (pct / 100);
  console.log(`Released pool: ${releasedPool.toLocaleString()} PLOT`);

  const rows = await fetchWeightedSpend();
  if (rows.length === 0) {
    console.log("\nZero total weighted spend — no activated wallets bought. Full burn.");
    return;
  }

  const distribution = computeDistribution(rows, releasedPool);
  if (distribution.length === 0) {
    console.log("\nNo eligible participants after distribution. Full burn.");
    return;
  }

  console.log(`\naddress,plot_share_wei`);
  for (const d of distribution) {
    console.log(`${d.address},${d.amount.toString()}`);
  }

  const { root, proofs } = generateMerkleTree(distribution);
  console.log(`\nMerkle root: ${root}`);

  await storeProofs(proofs, root, tier, twap);

  const burnPct = 100 - pct;
  const burnAmount = config.POOL_AMOUNT * (burnPct / 100);
  console.log("\n=== Summary ===");
  console.log(`TWAP MCap: $${twap.toLocaleString()}`);
  console.log(`Milestone: ${tier} (${pct}% distributed)`);
  console.log(`Distribute: ${releasedPool.toLocaleString()} PLOT to ${distribution.length} addresses`);
  console.log(`Burn: ${burnAmount.toLocaleString()} PLOT (${burnPct}%)`);
  console.log(`Merkle root: ${root}`);
  console.log(`\nNext: deploy MerkleClaim contract with this root.`);
}

main().catch((err) => {
  console.error("Finalization failed:", err);
  process.exit(1);
});
