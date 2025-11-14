import { AssetType, StrategySignal } from "../types";
import { fetchHistoricalData, calculateVolatility } from "../data/fetchHistorical";
import { maCrossoverStrategy } from "../strategies/maCrossover";
import { rsiMeanReversionStrategy } from "../strategies/rsiMeanReversion";
import { multiFactorStrategy } from "../strategies/multiFactor";
import { mlStrategy } from "../strategies/mlStrategy";
import { PriceData } from "../types";

export interface AssetDetails {
  ticker: string;
  assetType: AssetType;
  currentPrice: number;
  priceChangePct: number;
  volatility: number;
  historicalData: PriceData[];
  signals: StrategySignal[];
  statistics: {
    avgDailyReturn: number;
    maxDailyReturn: number;
    minDailyReturn: number;
    volatility: number;
  };
}

export async function getAssetDetails(ticker: string): Promise<AssetDetails> {
  // Determine asset type
  let assetType: AssetType = "stocks";
  if (ticker.includes("-USD")) assetType = "crypto";
  else if (ticker.includes("=X")) assetType = "forex";

  // Fetch historical data (180 days)
  const data = await fetchHistoricalData(ticker, assetType, 180);

  if (data.length === 0) {
    throw new Error("No data available");
  }

  // Get current price
  const currentPrice = data[data.length - 1].close;
  const prevPrice = data[data.length - 2]?.close || currentPrice;
  const priceChangePct = ((currentPrice - prevPrice) / prevPrice) * 100;

  // Run all strategies
  const signals = [
    maCrossoverStrategy(data),
    rsiMeanReversionStrategy(data),
    multiFactorStrategy(data),
    mlStrategy(data),
  ];

  // Calculate volatility
  const closes = data.map((d) => d.close);
  const volatility = calculateVolatility(closes, 60);

  // Calculate daily returns
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(((closes[i] - closes[i - 1]) / closes[i - 1]) * 100);
  }

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const maxReturn = Math.max(...returns);
  const minReturn = Math.min(...returns);

  return {
    ticker,
    assetType,
    currentPrice,
    priceChangePct,
    volatility,
    historicalData: data,
    signals,
    statistics: {
      avgDailyReturn: avgReturn,
      maxDailyReturn: maxReturn,
      minDailyReturn: minReturn,
      volatility: volatility * 100,
    },
  };
}
