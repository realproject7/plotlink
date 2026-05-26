// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../MerkleClaim.sol";

contract MockPLOT is ERC20 {
    constructor() ERC20("PLOT", "PLOT") {
        _mint(msg.sender, 1_000_000 ether);
    }
}

contract MerkleClaimTest is Test {
    MerkleClaim public mc;
    MockPLOT public plot;

    address owner = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address outsider = address(0xBAD);

    uint256 aliceAmount = 100 ether;
    uint256 bobAmount = 200 ether;

    bytes32 aliceLeaf;
    bytes32 bobLeaf;
    bytes32 root;
    bytes32[] aliceProof;
    bytes32[] bobProof;

    uint256 deadline;

    function setUp() public {
        plot = new MockPLOT();
        deadline = block.timestamp + 30 days;

        aliceLeaf = keccak256(bytes.concat(keccak256(abi.encode(alice, aliceAmount))));
        bobLeaf = keccak256(bytes.concat(keccak256(abi.encode(bob, bobAmount))));

        if (aliceLeaf <= bobLeaf) {
            root = keccak256(abi.encodePacked(aliceLeaf, bobLeaf));
        } else {
            root = keccak256(abi.encodePacked(bobLeaf, aliceLeaf));
        }

        aliceProof = new bytes32[](1);
        aliceProof[0] = bobLeaf;
        bobProof = new bytes32[](1);
        bobProof[0] = aliceLeaf;

        mc = new MerkleClaim(address(plot), root, deadline);
        plot.transfer(address(mc), 1000 ether);
    }

    function test_claim_BeforeDeadline_Succeeds() public {
        vm.prank(alice);
        mc.claim(aliceAmount, aliceProof);

        assertTrue(mc.claimed(alice));
        assertEq(plot.balanceOf(alice), aliceAmount);
    }

    function test_claim_AfterDeadline_Reverts() public {
        vm.warp(deadline + 1);
        vm.prank(alice);
        vm.expectRevert("Claim window closed");
        mc.claim(aliceAmount, aliceProof);
    }

    function test_claim_InvalidProof_Reverts() public {
        bytes32[] memory badProof = new bytes32[](1);
        badProof[0] = bytes32(uint256(0xdead));

        vm.prank(alice);
        vm.expectRevert("Invalid proof");
        mc.claim(aliceAmount, badProof);
    }

    function test_claim_DoubleClaim_Reverts() public {
        vm.prank(alice);
        mc.claim(aliceAmount, aliceProof);

        vm.prank(alice);
        vm.expectRevert("Already claimed");
        mc.claim(aliceAmount, aliceProof);
    }

    function test_sweep_BeforeDeadline_Reverts() public {
        vm.expectRevert("Claim window still open");
        mc.sweepUnclaimed(owner);
    }

    function test_sweep_AfterDeadline_BySomeone_Reverts() public {
        vm.warp(deadline + 1);
        vm.prank(outsider);
        vm.expectRevert("Not owner");
        mc.sweepUnclaimed(outsider);
    }

    function test_sweep_AfterDeadline_ByOwner_Succeeds() public {
        vm.warp(deadline + 1);
        uint256 balance = plot.balanceOf(address(mc));
        mc.sweepUnclaimed(owner);

        assertEq(plot.balanceOf(owner), 1_000_000 ether - 1000 ether + balance);
        assertEq(plot.balanceOf(address(mc)), 0);
    }

    function test_sweep_DoubleSweep_TransfersZero() public {
        vm.warp(deadline + 1);
        mc.sweepUnclaimed(owner);

        uint256 balBefore = plot.balanceOf(owner);
        mc.sweepUnclaimed(owner);
        assertEq(plot.balanceOf(owner), balBefore);
    }
}
