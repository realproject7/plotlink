#!/bin/bash
set -e
cd "$(dirname "$0")/.."
forge install OpenZeppelin/openzeppelin-contracts@v5.0.0 --no-git
forge install foundry-rs/forge-std --no-git
forge build
echo "✓ Foundry contracts ready"
