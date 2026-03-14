/**
 * Contract addresses and chain configuration for PlotLink on Base.
 *
 * Source: proposal §12 (External Dependencies).
 *
 * PlotLink-owned contracts (StoryFactory, ZapPlotLinkMCV2, $PLOT) use
 * placeholder zero addresses until deployed to Base mainnet.
 */

// ---------------------------------------------------------------------------
// Chain
// ---------------------------------------------------------------------------

export const BASE_CHAIN_ID = 8453;

// ---------------------------------------------------------------------------
// PlotLink contracts
// ---------------------------------------------------------------------------

/** StoryFactory — storyline + plot management
 *  Base Sepolia: 0x05C4d59529807316D6fA09cdaA509adDfe85b474
 *  Base Mainnet: TBD (replace after mainnet deployment) */
export const STORY_FACTORY = "0x0000000000000000000000000000000000000000" as const;

/** ZapPlotLinkMCV2 — one-click buy (ETH/USDC/HUNT -> storyline token) */
export const ZAP_PLOTLINK = "0x0000000000000000000000000000000000000000" as const;

/** $PLOT protocol token (ERC-20, issued via Mint Club backed by $HUNT) */
export const PLOT_TOKEN = "0x0000000000000000000000000000000000000000" as const;

// ---------------------------------------------------------------------------
// Mint Club V2 (deployed on Base — immutable third-party contracts)
// ---------------------------------------------------------------------------

/** MCV2_Bond — bonding curve trading, token creation, royalty distribution */
export const MCV2_BOND = "0xc5a076cad94176c2996B32d8466Be1cE757FAa27" as const;

/** MCV2_BondPeriphery — helper for multi-step bond operations */
export const MCV2_BOND_PERIPHERY = "0x492C412369Db76C9cdD9939e6C521579301473a3" as const;

// ---------------------------------------------------------------------------
// Uniswap V4 (Base)
// ---------------------------------------------------------------------------

/** Universal Router — swap execution */
export const UNISWAP_V4_ROUTER = "0x6fF5693b99212Da76ad316178A184AB56D299b43" as const;

/** Quoter — price estimation for frontend quotes */
export const UNISWAP_V4_QUOTER = "0x0d5e0F971ED27FBfF6c2837bf31316121532048D" as const;

/** Permit2 — gasless token approvals */
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;

// ---------------------------------------------------------------------------
// ERC-8004 Agent Identity (Base)
// ---------------------------------------------------------------------------

/** Agent Registry — agent writer identity NFTs and reputation */
export const ERC8004_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;
