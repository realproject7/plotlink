/**
 * Contract ABIs for the PlotLink protocol.
 *
 * Mirrored from lib/contracts/abi.ts and lib/contracts/erc8004.ts in the web
 * app. The SDK keeps its own copy to avoid cross-package imports.
 */

// ---------------------------------------------------------------------------
// StoryFactory
// ---------------------------------------------------------------------------

export const storyFactoryAbi = [
  // Events
  {
    type: "event",
    name: "PlotChained",
    inputs: [
      { name: "storylineId", type: "uint256", indexed: true },
      { name: "plotIndex", type: "uint256", indexed: true },
      { name: "writer", type: "address", indexed: true },
      { name: "title", type: "string", indexed: false },
      { name: "contentCID", type: "string", indexed: false },
      { name: "contentHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "StorylineCreated",
    inputs: [
      { name: "storylineId", type: "uint256", indexed: true },
      { name: "writer", type: "address", indexed: true },
      { name: "tokenAddress", type: "address", indexed: false },
      { name: "title", type: "string", indexed: false },
      { name: "hasDeadline", type: "bool", indexed: false },
      { name: "openingCID", type: "string", indexed: false },
      { name: "openingHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Donation",
    inputs: [
      { name: "storylineId", type: "uint256", indexed: true },
      { name: "donor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  // Functions
  {
    type: "function",
    name: "createStoryline",
    stateMutability: "nonpayable",
    inputs: [
      { name: "title", type: "string" },
      { name: "openingCID", type: "string" },
      { name: "openingHash", type: "bytes32" },
      { name: "hasDeadline", type: "bool" },
    ],
    outputs: [{ name: "storylineId", type: "uint256" }],
  },
  {
    type: "function",
    name: "chainPlot",
    stateMutability: "nonpayable",
    inputs: [
      { name: "storylineId", type: "uint256" },
      { name: "title", type: "string" },
      { name: "contentCID", type: "string" },
      { name: "contentHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "donate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "storylineId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

// ---------------------------------------------------------------------------
// ERC-8004 Agent Registry
// ---------------------------------------------------------------------------

export const erc8004Abi = [
  {
    type: "function",
    name: "agentIdByWallet",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "setAgentWallet",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newWallet", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// MCV2_Bond (Mint Club V2 bonding curve)
// ---------------------------------------------------------------------------

export const mcv2BondAbi = [
  {
    type: "function",
    name: "getRoyaltyInfo",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "beneficiary", type: "address" },
    ],
    outputs: [{ name: "unclaimed", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimRoyalties",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "priceForNextMint",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint128" }],
  },
  {
    type: "function",
    name: "tokenBond",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "mintRoyalty", type: "uint16" },
      { name: "burnRoyalty", type: "uint16" },
      { name: "createdAt", type: "uint40" },
      { name: "reserveToken", type: "address" },
      { name: "reserveBalance", type: "uint256" },
    ],
  },
] as const;
