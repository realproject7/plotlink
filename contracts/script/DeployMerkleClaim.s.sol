// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../MerkleClaim.sol";

contract DeployMerkleClaim is Script {
    function run() external {
        address plotToken = vm.envAddress("PLOT_TOKEN_ADDRESS");
        bytes32 merkleRoot = vm.envBytes32("MERKLE_ROOT");
        uint256 claimDeadline = vm.envUint("CLAIM_DEADLINE");

        vm.startBroadcast();
        new MerkleClaim(plotToken, merkleRoot, claimDeadline);
        vm.stopBroadcast();
    }
}
