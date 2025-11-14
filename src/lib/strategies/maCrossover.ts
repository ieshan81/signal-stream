import { StrategySignal, SignalDirection, PriceData } from "../types";
import { calculateSMA } from "../data/fetchHistorical";

interface MACrossoverParams {
  shortWindow?: number;
  longWindow?: number;
}

/**
 * Moving Average Crossover Strategy
 * Generates buy signals when short MA crosses above long MA
 * Generates sell signals when short MA crosses below long MA
 */
export function maCrossoverStrategy(
  data: PriceData[],
  params: MACrossoverParams = {}
): StrategySignal {
  const shortWindow = params.shortWindow || 50;
  const longWindow = params.longWindow || 200;

  if (data.length < longWindow) {
    return {
      name: "MA Crossover",
      rawScore: 0,
      normalizedScore: 0,
      direction: "neutral",
      meta: { error: "Insufficient data" },
    };
  }

  const closes = data.map((d) => d.close);
  const shortMA = calculateSMA(closes, shortWindow);
  const longMA = calculateSMA(closes, longWindow);

  // Get last valid values
  const lastShortMA = shortMA[shortMA.length - 1];
  const lastLongMA = longMA[longMA.length - 1];
  const prevShortMA = shortMA[shortMA.length - 2];
  const prevLongMA = longMA[longMA.length - 2];
  const lastPrice = closes[closes.length - 1];

  // Calculate raw score as difference between MAs
  const rawScore = lastShortMA - lastLongMA;

  // Normalize by price
  const normalizedScore = (rawScore / lastPrice) * 100;

  // Determine direction based on crossover
  let direction: SignalDirection = "neutral";

  if (prevShortMA <= prevLongMA && lastShortMA > lastLongMA) {
    // Golden cross - bullish
    direction = "buy";
  } else if (prevShortMA >= prevLongMA && lastShortMA < lastLongMA) {
    // Death cross - bearish
    direction = "sell";
  } else if (lastShortMA > lastLongMA) {
    // Short above long - bullish trend
    direction = "buy";
  } else if (lastShortMA < lastLongMA) {
    // Short below long - bearish trend
    direction = "sell";
  }

  return {
    name: "MA Crossover",
    rawScore,
    normalizedScore,
    direction,
    meta: {
      shortMA: lastShortMA.toFixed(2),
      longMA: lastLongMA.toFixed(2),
      shortWindow,
      longWindow,
    },
  };
}
