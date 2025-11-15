import { PriceData, AssetType } from "../types";
import { getDataEndpoint, toBinanceSymbol } from "../utils/tickerMapping";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Fetches historical price data for a given ticker from real market data APIs
 * - Stocks/Forex: Alpha Vantage (via market-data edge function)
 * - Crypto: Binance (via crypto-data edge function)
 */
export async function fetchHistoricalData(
  ticker: string,
  assetType: AssetType,
  days: number = 365
): Promise<PriceData[]> {
  try {
    let url: string;
    
    if (assetType === "crypto") {
      const symbol = toBinanceSymbol(ticker);
      url = `${SUPABASE_URL}/functions/v1/crypto-data?action=historical&symbol=${symbol}&limit=${days}`;
    } else {
      url = `${SUPABASE_URL}/functions/v1/market-data?action=historical&ticker=${ticker}&days=${days}`;
    }

    console.log(`[Fetch Historical] ${ticker} (${assetType})`);
    const response = await fetch(url);
    
    const data = await response.json();
    
    if (!response.ok || data.error) {
      const errorMsg = data.error || data.message || `Failed to fetch data for ${ticker}`;
      throw new Error(errorMsg);
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`No data available for ticker "${ticker}". Please verify the ticker symbol is correct.`);
    }

    // Filter out invalid data points
    return data.filter((d: PriceData) => d.close > 0);
  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error);
    throw error;
  }
}

/**
 * Fetches current price for a ticker from real market data APIs
 */
export async function fetchCurrentPrice(ticker: string, assetType?: AssetType): Promise<number> {
  try {
    // Detect asset type if not provided
    const type = assetType || (ticker.includes('-USD') ? 'crypto' : ticker.includes('=X') ? 'forex' : 'stocks');
    
    let url: string;
    
    if (type === "crypto") {
      const symbol = toBinanceSymbol(ticker);
      url = `${SUPABASE_URL}/functions/v1/crypto-data?action=current&symbol=${symbol}`;
    } else {
      url = `${SUPABASE_URL}/functions/v1/market-data?action=current&ticker=${ticker}`;
    }

    console.log(`[Fetch Current] ${ticker} (${type})`);
    const response = await fetch(url);
    
    const data = await response.json();
    
    if (!response.ok || data.error) {
      const errorMsg = data.error || data.message || `Failed to fetch current price for ${ticker}`;
      throw new Error(errorMsg);
    }

    if (!data.price || data.price <= 0) {
      throw new Error(`Invalid price data for ticker "${ticker}". Please verify the ticker symbol.`);
    }

    return data.price;
  } catch (error) {
    console.error(`Error fetching current price for ${ticker}:`, error);
    throw error;
  }
}

/**
 * Calculate daily returns from price data
 */
export function calculateReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return returns;
}

/**
 * Calculate Simple Moving Average
 */
export function calculateSMA(data: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

/**
 * Calculate Relative Strength Index (RSI)
 */
export function calculateRSI(closes: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  const changes: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  for (let i = 0; i < changes.length; i++) {
    if (i < period) {
      rsi.push(NaN);
    } else {
      const gains = changes
        .slice(i - period + 1, i + 1)
        .filter((c) => c > 0)
        .reduce((a, b) => a + b, 0) / period;
      const losses =
        Math.abs(
          changes
            .slice(i - period + 1, i + 1)
            .filter((c) => c < 0)
            .reduce((a, b) => a + b, 0)
        ) / period;

      if (losses === 0) {
        rsi.push(100);
      } else {
        const rs = gains / losses;
        rsi.push(100 - 100 / (1 + rs));
      }
    }
  }

  // Prepend NaN for first close (no change)
  return [NaN, ...rsi];
}

/**
 * Calculate volatility (standard deviation of returns)
 */
export function calculateVolatility(prices: number[], period: number = 30): number {
  if (prices.length < period) {
    return 0;
  }

  const returns = calculateReturns(prices.slice(-period));
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

  return Math.sqrt(variance) * Math.sqrt(252); // Annualized
}
