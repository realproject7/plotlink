/**
 * StoryFactory contract ABIs — event signatures and write functions.
 *
 * Source: proposal §4.1 (events), §4.3 (StoryFactory interface).
 * Contract address: see constants.ts (TBD until deployment).
 */

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const plotChainedEvent = {
  type: "event",
  name: "PlotChained",
  inputs: [
    { name: "storylineId", type: "uint256", indexed: true },
    { name: "plotIndex", type: "uint256", indexed: true },
    { name: "writer", type: "address", indexed: true },
    { name: "contentCID", type: "string", indexed: false },
    { name: "contentHash", type: "bytes32", indexed: false },
  ],
} as const;

export const storylineCreatedEvent = {
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
} as const;

export const donationEvent = {
  type: "event",
  name: "Donation",
  inputs: [
    { name: "storylineId", type: "uint256", indexed: true },
    { name: "donor", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
  ],
} as const;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

export const createStorylineFunction = {
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
} as const;

export const chainPlotFunction = {
  type: "function",
  name: "chainPlot",
  stateMutability: "nonpayable",
  inputs: [
    { name: "storylineId", type: "uint256" },
    { name: "contentCID", type: "string" },
    { name: "contentHash", type: "bytes32" },
  ],
  outputs: [],
} as const;

export const donateFunction = {
  type: "function",
  name: "donate",
  stateMutability: "nonpayable",
  inputs: [
    { name: "storylineId", type: "uint256" },
    { name: "amount", type: "uint256" },
  ],
  outputs: [],
} as const;

// ---------------------------------------------------------------------------
// MCV2_Bond view functions
// ---------------------------------------------------------------------------

/** Current cost (in reserve token) to mint 1 unit of the given token. */
export const priceForNextMintFunction = {
  type: "function",
  name: "priceForNextMint",
  stateMutability: "view",
  inputs: [{ name: "token", type: "address" }],
  outputs: [{ name: "", type: "uint128" }],
} as const;

/** Full bond info for a token: creator, royalties, creation time, reserve. */
export const tokenBondFunction = {
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
} as const;

// ---------------------------------------------------------------------------
// Combined ABI (for viem contract instances)
// ---------------------------------------------------------------------------

export const storyFactoryAbi = [
  plotChainedEvent,
  storylineCreatedEvent,
  donationEvent,
  createStorylineFunction,
  chainPlotFunction,
  donateFunction,
] as const;
