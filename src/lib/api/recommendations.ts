import { AssetType, AssetRecommendation } from "../types";
import { fetchHistoricalData, calculateVolatility } from "../data/fetchHistorical";
import { maCrossoverStrategy } from "../strategies/maCrossover";
import { rsiMeanReversionStrategy } from "../strategies/rsiMeanReversion";
import { multiFactorStrategy } from "../strategies/multiFactor";
import { mlStrategy } from "../strategies/mlStrategy";
import { aggregateSignals, rankRecommendations } from "../recommender/aggregateSignals";

const DEFAULT_TICKERS = {
  stocks: ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "JPM", "V", "JNJ"],
  crypto: ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "ADA-USD"],
  forex: ["EURUSD=X", "GBPUSD=X", "USDJPY=X"],
};

export async function getRecommendations(
  assetType: AssetType | "all" = "all",
  tickers?: string[],
  limit?: number
): Promise<{ recommendations: AssetRecommendation[]; lastUpdate: string; totalCount: number }> {
  // Determine tickers to analyze
  let tickersToAnalyze: string[] = [];
  if (tickers && tickers.length > 0) {
    tickersToAnalyze = tickers;
  } else if (assetType !== "all") {
    tickersToAnalyze = DEFAULT_TICKERS[assetType] || [];
  } else {
    // All assets
    tickersToAnalyze = [
      ...DEFAULT_TICKERS.stocks,
      ...DEFAULT_TICKERS.crypto,
      ...DEFAULT_TICKERS.forex,
    ];
  }

  const actualLimit = limit || tickersToAnalyze.length;

  // Generate recommendations
  const recommendations: AssetRecommendation[] = [];

  for (const ticker of tickersToAnalyze) {
    try {
      // Determine asset type
      let tickerAssetType: AssetType = "stocks";
      if (ticker.includes("-USD")) tickerAssetType = "crypto";
      else if (ticker.includes("=X")) tickerAssetType = "forex";

      // Fetch historical data
      const data = await fetchHistoricalData(ticker, tickerAssetType, 365);

      if (data.length < 200) {
        console.log(`Skipping ${ticker}: insufficient data`);
        continue;
      }

      // Get current price
      const currentPrice = data[data.length - 1].close;
      const prevPrice = data[data.length - 2].close;
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

      // Aggregate signals
      const recommendation = aggregateSignals(
        ticker,
        tickerAssetType,
        currentPrice,
        priceChangePct,
        volatility,
        signals
      );

      recommendations.push(recommendation);
    } catch (error) {
      console.error(`Error processing ${ticker}:`, error);
    }
  }

  // Rank and limit
  const rankedRecommendations = rankRecommendations(recommendations).slice(0, actualLimit);

  return {
    recommendations: rankedRecommendations,
    lastUpdate: new Date().toISOString(),
    totalCount: rankedRecommendations.length,
  };
}
