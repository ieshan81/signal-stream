import { PriceData, AssetType } from "../types";

/**
 * Fetches historical price data for a given ticker
 * Uses Yahoo Finance API as a free data source
 */
export async function fetchHistoricalData(
  ticker: string,
  assetType: AssetType,
  days: number = 365
): Promise<PriceData[]> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const period1 = Math.floor(startDate.getTime() / 1000);
    const period2 = Math.floor(endDate.getTime() / 1000);

    // Use Yahoo Finance API
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=1d`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data for ${ticker}`);
    }

    const data = await response.json();
    const result = data.chart.result[0];

    if (!result || !result.timestamp) {
      throw new Error(`No data available for ${ticker}`);
    }

    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];

    const priceData: PriceData[] = timestamps.map((timestamp: number, i: number) => ({
      date: new Date(timestamp * 1000).toISOString().split("T")[0],
      open: quotes.open[i] || 0,
      high: quotes.high[i] || 0,
      low: quotes.low[i] || 0,
      close: quotes.close[i] || 0,
      volume: quotes.volume[i] || 0,
    }));

    // Filter out invalid data points
    return priceData.filter((d) => d.close > 0);
  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error);
    throw error;
  }
}

/**
 * Fetches current price for a ticker
 */
export async function fetchCurrentPrice(ticker: string): Promise<number> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch current price for ${ticker}`);
    }

    const data = await response.json();
    const result = data.chart.result[0];

    if (!result || !result.meta) {
      throw new Error(`No price data available for ${ticker}`);
    }

    return result.meta.regularMarketPrice || 0;
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
