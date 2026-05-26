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

## Deploy

Set env vars (never commit real keys):

```bash
export BASE_RPC_URL=https://mainnet.base.org
export DEPLOYER_PRIVATE_KEY=<your-key>
export PLOT_TOKEN_ADDRESS=0x4F567DACBF9D15A6acBe4A47FC2Ade0719Fb63C4
export MERKLE_ROOT=<from-finalize-script>
export CLAIM_DEADLINE=<unix-timestamp>
```

```bash
forge script contracts/script/DeployMerkleClaim.s.sol \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --private-key $DEPLOYER_PRIVATE_KEY
```
