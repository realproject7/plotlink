// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MerkleClaim
/// @notice Merkle-tree based airdrop claim contract for PLOT tokens with
///         owner-gated sweep after a claim deadline.
contract MerkleClaim {
    IERC20 public immutable PLOT;
    bytes32 public immutable merkleRoot;
    address public immutable owner;
    uint256 public immutable claimDeadline;

    mapping(address => bool) public claimed;

    event Claimed(address indexed account, uint256 amount);
    event Swept(address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _plot, bytes32 _merkleRoot, uint256 _claimDeadline) {
        PLOT = IERC20(_plot);
        merkleRoot = _merkleRoot;
        owner = msg.sender;
        claimDeadline = _claimDeadline;
    }

    function claim(uint256 amount, bytes32[] calldata proof) external {
        require(block.timestamp <= claimDeadline, "Claim window closed");
        require(!claimed[msg.sender], "Already claimed");

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Invalid proof");

        claimed[msg.sender] = true;
        require(PLOT.transfer(msg.sender, amount), "Transfer failed");

        emit Claimed(msg.sender, amount);
    }

    function sweepUnclaimed(address to) external onlyOwner {
        require(block.timestamp > claimDeadline, "Claim window still open");
        uint256 remaining = PLOT.balanceOf(address(this));
        require(PLOT.transfer(to, remaining), "Sweep failed");
        emit Swept(to, remaining);
    }
}
