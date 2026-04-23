/**
 * USD Price for PLOT token (server-side)
 *
 * Parallel fetch: Mint Club SDK | GeckoTerminal | CoinGecko (Promise.any)
 * Fallback: in-memory cache → DB cache (trade_history.reserve_usd_rate)
 *
 * Only tracks PLOT USD price — storyline token USD values are derived from it:
 *   storyline_token_USD = storyline_token_price_in_PLOT × PLOT_USD_price
 *
 * Reference: ~/Projects/dropcast/lib/usd-price.ts
 */

import { PLOT_TOKEN } from "./contracts/constants";
import { createServiceRoleClient } from "./supabase";
import { formatSubscriptPrice } from "./format";

// In-memory cache
let cachedPrice: number | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// In-flight coalescing
let inflightRequest: Promise<number | null> | null = null;

const PLOT_ADDRESS = PLOT_TOKEN.toLowerCase();

/**
 * Get PLOT token USD price with parallel sources + DB fallback
 */
export async function getPlotUsdPrice(
  forceRefresh = false,
): Promise<number | null> {
  // Return cached price if fresh
  if (!forceRefresh && cachedPrice !== null && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedPrice;
  }

  // Coalesce concurrent requests
  if (inflightRequest && !forceRefresh) {
    return inflightRequest;
  }

  inflightRequest = fetchPlotUsdPrice();
  try {
    const price = await inflightRequest;
    if (price !== null) {
      cachedPrice = price;
      cacheTimestamp = Date.now();
    }
    return price ?? cachedPrice;
  } finally {
    inflightRequest = null;
  }
}

async function fetchPlotUsdPrice(): Promise<number | null> {
  const start = Date.now();

  // Prefer Mint Club SDK (on-chain read, matches /token page price source)
  // Only fall back to API aggregators if on-chain fails
  try {
    const price = await fetchFromMintClub();
    console.info(`[USD Price] result=hit price=${price} elapsed=${Date.now() - start}ms`);
    return price;
  } catch {
    // Mint Club SDK failed — try API aggregators
  }

  try {
    const price = await Promise.any([
      fetchFromGeckoTerminal(),
      fetchFromCoinGecko(),
    ]);
    console.info(`[USD Price] result=hit price=${price} elapsed=${Date.now() - start}ms (api fallback)`);
    return price;
  } catch {
    console.warn(`[USD Price] All external sources failed, elapsed=${Date.now() - start}ms`);
  }

  // Fallback: last known price from trade_history DB
  const dbPrice = await fetchFromDb();
  if (dbPrice !== null) {
    console.info(`[USD Price] result=db_fallback price=${dbPrice}`);
    return dbPrice;
  }

  console.warn(`[USD Price] All sources exhausted for PLOT token`);
  return null;
}

/** Mint Club SDK — on-chain RPC call (with 3s timeout to match other sources) */
async function fetchFromMintClub(): Promise<number> {
  const start = Date.now();
  try {
    const result = await Promise.race([
      (async () => {
        const { mintclub } = await import(/* webpackIgnore: true */ "mint.club-v2-sdk" as string) as { mintclub: { network: (n: string) => { token: (a: `0x${string}`) => { getUsdRate: () => Promise<{ usdRate: number }> } } } };
        const token = mintclub.network("base").token(PLOT_TOKEN);
        return token.getUsdRate();
      })(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 3000),
      ),
    ]);
    if (result.usdRate && result.usdRate > 0) {
      console.info(`[USD Price] source=mint_club result=hit elapsed=${Date.now() - start}ms`);
      return result.usdRate;
    }
    throw new Error("invalid rate");
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown";
    console.info(`[USD Price] source=mint_club result=miss reason=${reason} elapsed=${Date.now() - start}ms`);
  }
  throw new Error("mint_club failed");
}

/** GeckoTerminal — free HTTP API */
async function fetchFromGeckoTerminal(): Promise<number> {
  const start = Date.now();
  try {
    const url = `https://api.geckoterminal.com/api/v2/networks/base/tokens/${PLOT_ADDRESS}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`http_${response.status}`);
    const data = await response.json();
    const priceUsd = data?.data?.attributes?.price_usd;
    if (priceUsd) {
      const price = parseFloat(priceUsd);
      if (!isNaN(price) && price > 0) {
        console.info(`[USD Price] source=geckoterminal result=hit elapsed=${Date.now() - start}ms`);
        return price;
      }
    }
    throw new Error("no_price_data");
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown";
    console.info(`[USD Price] source=geckoterminal result=miss reason=${reason} elapsed=${Date.now() - start}ms`);
  }
  throw new Error("geckoterminal failed");
}

/** CoinGecko — HTTP API (optional key) */
async function fetchFromCoinGecko(): Promise<number> {
  const start = Date.now();
  try {
    const apiKey = process.env.COINGECKO_API_KEY;
    const url = `https://api.coingecko.com/api/v3/simple/token_price/base?contract_addresses=${PLOT_ADDRESS}&vs_currencies=usd`;
    const headers: HeadersInit = { Accept: "application/json" };
    if (apiKey) headers["x-cg-demo-api-key"] = apiKey;

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`http_${response.status}`);
    const data = await response.json();
    const tokenData = data[PLOT_ADDRESS];
    if (tokenData?.usd && tokenData.usd > 0) {
      console.info(`[USD Price] source=coingecko result=hit elapsed=${Date.now() - start}ms`);
      return tokenData.usd;
    }
    throw new Error("no_price_data");
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown";
    console.info(`[USD Price] source=coingecko result=miss reason=${reason} elapsed=${Date.now() - start}ms`);
  }
  throw new Error("coingecko failed");
}

/** DB fallback: latest reserve_usd_rate from trade_history (survives cold starts) */
async function fetchFromDb(): Promise<number | null> {
  try {
    const supabase = createServiceRoleClient();
    if (!supabase) return null;

    const { data } = await supabase
      .from("trade_history")
      .select("reserve_usd_rate")
      .not("reserve_usd_rate", "is", null)
      .order("block_timestamp", { ascending: false })
      .limit(1)
      .single();

    if (data?.reserve_usd_rate && data.reserve_usd_rate > 0) {
      return data.reserve_usd_rate;
    }
  } catch {
    console.info(`[USD Price] source=db result=miss`);
  }
  return null;
}

/**
 * Format a USD value for display
 */
export function formatUsdValue(value: number | null): string {
  if (value === null) return "—";
  if (value < 0.01) return "< $0.01";
  if (value < 1) return `$${value.toFixed(3)}`;
  if (value < 1000) return `$${value.toFixed(2)}`;
  if (value < 1_000_000) return `$${(value / 1000).toFixed(2)}K`;
  return `$${(value / 1_000_000).toFixed(2)}M`;
}

/**
 * Format a USD token price with full precision for small values.
 * Shows enough significant digits to expose the actual price
 * instead of hiding it behind "< $0.01".
 */
export function formatUsdTokenPrice(value: number | null): string {
  if (value === null) return "—";
  if (value === 0) return "$0";
  if (value >= 0.01) return formatUsdValue(value);
  return formatSubscriptPrice(value);
}
