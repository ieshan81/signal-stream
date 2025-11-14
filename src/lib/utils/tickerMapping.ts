import { AssetType } from "../types";

/**
 * Determine asset type from ticker format
 */
export function getAssetType(ticker: string): AssetType {
  if (ticker.includes('-USD') || ticker.includes('USDT')) {
    return 'crypto';
  }
  if (ticker.includes('=X')) {
    return 'forex';
  }
  return 'stocks';
}

/**
 * Convert frontend ticker to Binance symbol format
 * BTC-USD -> BTCUSDT
 */
export function toBinanceSymbol(ticker: string): string {
  return ticker.replace('-USD', 'USDT').replace('-USDT', 'USDT');
}

/**
 * Convert Binance symbol to frontend ticker format
 * BTCUSDT -> BTC-USD
 */
export function fromBinanceSymbol(symbol: string): string {
  return symbol.replace('USDT', '-USD');
}

/**
 * Convert frontend ticker to Alpha Vantage symbol format
 * EURUSD=X -> EUR/USD
 */
export function toAlphaVantageSymbol(ticker: string): string {
  if (ticker.includes('=X')) {
    return ticker.replace('=X', '').replace(/(.{3})(.{3})/, '$1/$2');
  }
  return ticker;
}

/**
 * Get the API endpoint URL for fetching data
 */
export function getDataEndpoint(ticker: string, assetType: AssetType): string {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  if (assetType === 'crypto') {
    return `${baseUrl}/functions/v1/crypto-data`;
  }
  
  return `${baseUrl}/functions/v1/market-data`;
}
