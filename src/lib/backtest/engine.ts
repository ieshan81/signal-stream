import { BacktestConfig, BacktestResult, Trade, PriceData, AssetType } from "../types";
import { fetchHistoricalData } from "../data/fetchHistorical";
import { maCrossoverStrategy } from "../strategies/maCrossover";
import { rsiMeanReversionStrategy } from "../strategies/rsiMeanReversion";
import { multiFactorStrategy } from "../strategies/multiFactor";
import { mlStrategy } from "../strategies/mlStrategy";
import { aggregateSignals } from "../recommender/aggregateSignals";
import { calculatePerformanceMetrics } from "../metrics/performance";

/**
 * Runs a backtest simulation
 */
export async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
  const {
    tickers,
    assetType,
    strategies,
    startDate,
    endDate,
    rebalancePeriod,
    initialCapital,
  } = config;

  // Fetch historical data for all tickers
  const tickerDataMap: Record<string, PriceData[]> = {};

  for (const ticker of tickers) {
    try {
      const data = await fetchHistoricalData(ticker, assetType, 400);
      // Filter by date range
      const filteredData = data.filter((d) => d.date >= startDate && d.date <= endDate);
      tickerDataMap[ticker] = filteredData;
    } catch (error) {
      console.error(`Failed to fetch data for ${ticker}:`, error);
    }
  }

  // Get all unique dates
  const allDates = new Set<string>();
  Object.values(tickerDataMap).forEach((data) => {
    data.forEach((d) => allDates.add(d.date));
  });

  const sortedDates = Array.from(allDates).sort();

  if (sortedDates.length === 0) {
    throw new Error("No data available for backtest");
  }

  // Initialize portfolio
  let cash = initialCapital;
  let holdings: Record<string, number> = {}; // ticker -> quantity
  const equityCurve: { date: string; value: number }[] = [];
  const trades: Trade[] = [];
  const periodReturns: number[] = [];

  let lastRebalanceDate = sortedDates[0];
  let portfolioValueAtLastRebalance = initialCapital;

  // Iterate through dates
  for (let i = 0; i < sortedDates.length; i++) {
    const date = sortedDates[i];

    // Check if it's time to rebalance
    const daysSinceRebalance = Math.floor(
      (new Date(date).getTime() - new Date(lastRebalanceDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (daysSinceRebalance >= rebalancePeriod || i === 0) {
      // Calculate current portfolio value
      const currentPortfolioValue = calculatePortfolioValue(
        cash,
        holdings,
        tickerDataMap,
        date
      );

      // Calculate period return
      if (i > 0) {
        const periodReturn =
          (currentPortfolioValue - portfolioValueAtLastRebalance) /
          portfolioValueAtLastRebalance;
        periodReturns.push(periodReturn);
      }

      // Rebalance: sell all holdings
      for (const [ticker, quantity] of Object.entries(holdings)) {
        const price = getPriceAtDate(tickerDataMap[ticker], date);
        if (price > 0) {
          const saleValue = quantity * price;
          cash += saleValue;
          trades.push({
            date,
            ticker,
            action: "sell",
            price,
            quantity,
            value: saleValue,
          });
        }
      }
      holdings = {};

      // Generate recommendations for all tickers
      const recommendations = await generateRecommendations(
        tickers,
        assetType,
        tickerDataMap,
        date,
        strategies
      );

      // Select top N buy recommendations
      const buyRecommendations = recommendations
        .filter((r) => r.recommendation === "BUY")
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Top 5 buys

      // Allocate capital equally among selected assets
      if (buyRecommendations.length > 0) {
        const capitalPerAsset = cash / buyRecommendations.length;

        for (const rec of buyRecommendations) {
          const price = getPriceAtDate(tickerDataMap[rec.ticker], date);
          if (price > 0) {
            const quantity = Math.floor(capitalPerAsset / price);
            if (quantity > 0) {
              const purchaseValue = quantity * price;
              cash -= purchaseValue;
              holdings[rec.ticker] = quantity;
              trades.push({
                date,
                ticker: rec.ticker,
                action: "buy",
                price,
                quantity,
                value: purchaseValue,
              });
            }
          }
        }
      }

      lastRebalanceDate = date;
      portfolioValueAtLastRebalance = calculatePortfolioValue(
        cash,
        holdings,
        tickerDataMap,
        date
      );
    }

    // Record daily portfolio value
    const portfolioValue = calculatePortfolioValue(cash, holdings, tickerDataMap, date);
    equityCurve.push({ date, value: portfolioValue });
  }

  // Calculate metrics
  const metrics = calculatePerformanceMetrics(equityCurve, periodReturns);

  return {
    equityCurve,
    metrics,
    trades,
  };
}

/**
 * Calculate portfolio value at a given date
 */
function calculatePortfolioValue(
  cash: number,
  holdings: Record<string, number>,
  tickerDataMap: Record<string, PriceData[]>,
  date: string
): number {
  let holdingsValue = 0;

  for (const [ticker, quantity] of Object.entries(holdings)) {
    const price = getPriceAtDate(tickerDataMap[ticker], date);
    holdingsValue += quantity * price;
  }

  return cash + holdingsValue;
}

/**
 * Get price at a specific date
 */
function getPriceAtDate(data: PriceData[], date: string): number {
  const point = data.find((d) => d.date === date);
  return point ? point.close : 0;
}

/**
 * Generate recommendations for all tickers at a specific date
 */
async function generateRecommendations(
  tickers: string[],
  assetType: AssetType,
  tickerDataMap: Record<string, PriceData[]>,
  date: string,
  selectedStrategies: string[]
) {
  const recommendations = [];

  for (const ticker of tickers) {
    const data = tickerDataMap[ticker];
    if (!data || data.length === 0) continue;

    // Get data up to current date
    const historicalData = data.filter((d) => d.date <= date);
    if (historicalData.length < 200) continue; // Need enough data

    // Get current price
    const currentPrice = getPriceAtDate(data, date);
    if (currentPrice === 0) continue;

    // Calculate price change
    const prevPrice =
      historicalData.length > 1
        ? historicalData[historicalData.length - 2].close
        : currentPrice;
    const priceChangePct = ((currentPrice - prevPrice) / prevPrice) * 100;

    // Run selected strategies
    const signals = [];
    if (selectedStrategies.includes("ma_crossover")) {
      signals.push(maCrossoverStrategy(historicalData));
    }
    if (selectedStrategies.includes("rsi_mean_reversion")) {
      signals.push(rsiMeanReversionStrategy(historicalData));
    }
    if (selectedStrategies.includes("multi_factor")) {
      signals.push(multiFactorStrategy(historicalData));
    }
    if (selectedStrategies.includes("ml_strategy")) {
      signals.push(mlStrategy(historicalData));
    }

    // Calculate volatility
    const closes = historicalData.map((d) => d.close);
    const volatility = calculateVolatility(closes);

    // Aggregate signals
    const recommendation = aggregateSignals(
      ticker,
      assetType,
      currentPrice,
      priceChangePct,
      volatility,
      signals
    );

    recommendations.push(recommendation);
  }

  return recommendations;
}

function calculateVolatility(prices: number[]): number {
  if (prices.length < 30) return 0;

  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }

  const recentReturns = returns.slice(-30);
  const mean = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;
  const variance =
    recentReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recentReturns.length;

  return Math.sqrt(variance) * Math.sqrt(252);
}
