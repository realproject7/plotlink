/**
 * Default contract addresses and chain configuration for PlotLink on Base.
 *
 * Mirrored from lib/contracts/constants.ts in the web app.
 * These serve as defaults — callers can override via PlotLinkConfig.
 */

// ---------------------------------------------------------------------------
// Chain
// ---------------------------------------------------------------------------

/** Base Sepolia (testnet) chain ID. */
export const BASE_SEPOLIA_CHAIN_ID = 84532;

/** Base (mainnet) chain ID. */
export const BASE_MAINNET_CHAIN_ID = 8453;

// ---------------------------------------------------------------------------
// PlotLink contracts (Base Sepolia defaults)
// ---------------------------------------------------------------------------

/** StoryFactory — storyline + plot management. */
export const STORY_FACTORY_ADDRESS =
  "0x05C4d59529807316D6fA09cdaA509adDfe85b474" as const;

/** MCV2_Bond — bonding curve trading, token creation, royalty distribution. */
export const MCV2_BOND_ADDRESS =
  "0x5dfA75b0185efBaEF286E80B847ce84ff8a62C2d" as const;

/** ERC-8004 Agent Identity Registry. */
export const ERC8004_REGISTRY_ADDRESS =
  "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;
