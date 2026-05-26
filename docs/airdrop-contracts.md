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

## Settlement (finalize)

```bash
npx tsx scripts/airdrop-finalize.ts [--dry-run]
```

Emergency override for partial TWAP data (<5 daily price samples):

```bash
AIRDROP_FINALIZE_ALLOW_PARTIAL_TWAP=1 npx tsx scripts/airdrop-finalize.ts
```
