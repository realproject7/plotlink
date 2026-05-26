# MerkleClaim Contract

## Setup (fresh clone)

```bash
# Install Foundry (if not already installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install contract dependencies
bash contracts/setup.sh
```

## Test

```bash
forge test -vv --match-path "contracts/test/*"
```

## Gas snapshot

```bash
forge snapshot --match-path "contracts/test/*"
```

Baseline (v2 with deadline): claim path 83,648 gas. v1 (no deadline) baseline ~82,000. Delta ~+2%, well within the +5% acceptance threshold.

## Deploy

Set env vars (never commit real keys):

```bash
export BASE_RPC_URL=https://mainnet.base.org
export DEPLOYER_PRIVATE_KEY=<your-key>
export PLOT_TOKEN_ADDRESS=<plot-token-address>
export MERKLE_ROOT=<from-finalize-script>
export CLAIM_DEADLINE=<unix-timestamp>
```

```bash
forge script contracts/script/DeployMerkleClaim.s.sol \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --private-key $DEPLOYER_PRIVATE_KEY
```

## Weighted Spend SQL Helper (T2.4b hybrid pattern)

The weighted spend computation uses a hybrid of T0.1's option A (TS config) and option B (DB function):

- **`lib/airdrop/sql.ts`** — TS wrapper `weightedSpendQuery(config)` returns `{sql, params}`. Config values (campaign dates, thresholds, multiplier params) flow from `getAirdropConfig()` at call time, supporting test-fast/test-full/prod modes.
- **`supabase/migrations/00041_weighted_spend_function.sql`** — Postgres function `weighted_spend(...)` is the single canonical SQL definition. All consumers (finalize script, /projection, /leaderboard) call this function.
- **`lib/airdrop/sql.ts:weightedSpendQuery()`** returns `SELECT * FROM weighted_spend($1, $2, $3, $4, $5)` — the TS wrapper delegates to the DB function.

This avoids both option A's risk (SQL string drift across consumers) and option B's downside (DB-resident config table).

## Settlement (finalize)

```bash
npx tsx scripts/airdrop-finalize.ts [--dry-run]
```

Emergency override for partial TWAP data (<5 daily price samples):

```bash
AIRDROP_FINALIZE_ALLOW_PARTIAL_TWAP=1 npx tsx scripts/airdrop-finalize.ts
```
