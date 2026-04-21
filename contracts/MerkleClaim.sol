// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PLOTAirdrop
 * @notice Merkle-tree based airdrop claim contract for PLOT tokens.
 * @dev Standard OpenZeppelin MerkleProof-based contract.
 *      Deploy with the PLOT token address and Merkle root from the finalize script.
 */
contract PLOTAirdrop {
    IERC20 public immutable PLOT;
    bytes32 public immutable merkleRoot;
    mapping(address => bool) public claimed;

    event Claimed(address indexed account, uint256 amount);

    constructor(address _plot, bytes32 _merkleRoot) {
        PLOT = IERC20(_plot);
        merkleRoot = _merkleRoot;
    }

    function claim(uint256 amount, bytes32[] calldata proof) external {
        require(!claimed[msg.sender], "Already claimed");

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Invalid proof");

        claimed[msg.sender] = true;
        require(PLOT.transfer(msg.sender, amount), "Transfer failed");

        emit Claimed(msg.sender, amount);
    }
}
