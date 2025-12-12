/**
 * Market Data Adapter Pattern
 * Supports multiple providers: yahoo_finance2 (default), alpha_vantage
 * Implements server-side caching with 60-second TTL
 */

import Decimal from "decimal.js";
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

export interface MarketPrice {
  symbol: string;
  price: number; // in PKR
  currency: string;
  timestamp: Date;
}

// Simple in-memory cache with TTL
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 60 seconds

function getCachedPrice(symbol: string): number | null {
  const cached = priceCache.get(symbol);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    priceCache.delete(symbol);
    return null;
  }

  return cached.price;
}

function setCachedPrice(symbol: string, price: number): void {
  priceCache.set(symbol, { price, timestamp: Date.now() });
}

/**
 * Fetch price from Yahoo Finance using yahoo-finance2 package
 * Free, no API key required
 * More reliable than manual fetch
 */
async function fetchFromYahooFinance2(symbol: string): Promise<number> {
  const upperSymbol = symbol.toUpperCase();
  
  try {
    // Try with the symbol as-is first
    let result = await yahooFinance.quote(upperSymbol+".KA");
    // Handle array response (yahoo-finance2 sometimes returns arrays)
    if (Array.isArray(result)) {
      if (result.length === 0) {
        throw new Error(`No data returned for ${upperSymbol}`);
      }
      result = result[0];
    }
    
    // Extract regular market price
    const price = result?.regularMarketPrice;
    
    if (typeof price === "number" && price > 0 && !isNaN(price)) {
      console.log(`[Market] Successfully fetched price for ${upperSymbol}: ${price} PKR`);
      return price;
    } else {
      // Try alternative price fields
      const altPrice = result?.price || result?.regularMarketPrice?.raw;
      if (typeof altPrice === "number" && altPrice > 0 && !isNaN(altPrice)) {
        console.log(`[Market] Successfully fetched price for ${upperSymbol} (alt field): ${altPrice} PKR`);
        return altPrice;
      }
      
      console.warn(`[Market] Invalid or missing price for ${upperSymbol}. Result:`, JSON.stringify(result, null, 2));
      return 0;
    }
  } catch (error) {
    console.error(`[Market] Error fetching price for ${upperSymbol} using yahoo-finance2:`, error instanceof Error ? error.message : error);
    return 0; // Return 0 instead of throwing, so app continues to work
  }
}

/**
 * Fetch price from Alpha Vantage
 * Requires MARKET_API_KEY environment variable
 */
async function fetchFromAlphaVantage(symbol: string, apiKey: string): Promise<number> {
  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol.toUpperCase()}&apikey=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Alpha Vantage API returned ${response.status}`);
    }

    const data = (await response.json()) as any;

    if (data["Error Message"]) {
      throw new Error(data["Error Message"]);
    }

    if (data["Note"]) {
      throw new Error("Alpha Vantage API rate limit exceeded");
    }

    const price = parseFloat(data["Global Quote"]["05. price"]);

    if (isNaN(price)) {
      throw new Error("Could not extract price from Alpha Vantage response");
    }

    // Return price in PKR
    return price;
  } catch (error) {
    console.error(`[Market] Alpha Vantage fetch failed for ${symbol}:`, error);
    throw new Error(`Failed to fetch price for ${symbol} from Alpha Vantage`);
  }
}

/**
 * Get market price for a stock symbol
 * Uses configured provider (default: yahoo_finance2)
 * Implements caching to reduce API calls (60 second TTL)
 */
export async function getMarketPrice(symbol: string): Promise<MarketPrice> {
  const upperSymbol = symbol.toUpperCase();

  // Check cache first
  const cachedPrice = getCachedPrice(upperSymbol);
  if (cachedPrice !== null && cachedPrice > 0) {
    return {
      symbol: upperSymbol,
      price: cachedPrice,
      currency: "PKR",
      timestamp: new Date(),
    };
  }

  // Determine which provider to use
  const provider = process.env.MARKET_API_PROVIDER || "yahoo_finance2";
  let price: number = 0; // Default to 0 if fetch fails

  try {
    if (provider === "alpha_vantage") {
      const apiKey = process.env.MARKET_API_KEY;
      if (!apiKey) {
        console.warn(`[Market] MARKET_API_KEY not set for ${upperSymbol}, skipping price fetch`);
        price = 0;
      } else {
        price = await fetchFromAlphaVantage(upperSymbol, apiKey);
      }
    } else if (provider === "yahoo_finance2" || provider === "yahoo_unofficial") {
      // Use yahoo-finance2 package (default)
      // price = await fetchFromYahooFinance2(upperSymbol);
    } else {
      console.warn(`[Market] Unknown provider: ${provider} for ${upperSymbol}, using yahoo_finance2`);
      // price = await fetchFromYahooFinance2(upperSymbol);
    }
  } catch (error) {
    console.warn(`[Market] Failed to fetch price for ${upperSymbol}:`, error);
    price = 0; // Fail gracefully
  }

  // Only cache if we got a valid price
  if (price > 0) {
    setCachedPrice(upperSymbol, price);
  }

  return {
    symbol: upperSymbol,
    price,
    currency: "PKR",
    timestamp: new Date(),
  };
}

/**
 * Calculate unrealized profit for a stock position
 * unrealized_profit = (current_price - avg_cost) * total_shares
 */
export function calculateUnrealizedProfit(
  totalShares: Decimal,
  avgCost: Decimal,
  currentPrice: number // in PKR
): number {
  const currentPriceDecimal = new Decimal(currentPrice);
  const unrealized = currentPriceDecimal.minus(avgCost).times(totalShares);
  return unrealized.toNumber();
}

/**
 * Calculate percentage gain/loss
 * %gain_loss = (current_price - avg_cost) / avg_cost * 100
 */
export function calculateGainLossPercent(avgCost: Decimal, currentPrice: number): number {
  if (avgCost.isZero()) return 0;

  const currentPriceDecimal = new Decimal(currentPrice);
  const change = currentPriceDecimal.minus(avgCost).dividedBy(avgCost).times(100);
  return change.toNumber();
}
