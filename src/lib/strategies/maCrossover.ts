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

  const getLastTwoValid = (values: number[]): [number | undefined, number | undefined] => {
    let last: number | undefined;
    let previous: number | undefined;

    for (let i = values.length - 1; i >= 0; i--) {
      const value = values[i];

      if (!Number.isNaN(value)) {
        if (last === undefined) {
          last = value;
        } else {
          previous = value;
          break;
        }
      }
    }

    return [last, previous];
  };

  const [lastShortMA, prevShortMA] = getLastTwoValid(shortMA);
  const [lastLongMA, prevLongMA] = getLastTwoValid(longMA);

  if (lastShortMA === undefined || lastLongMA === undefined) {
    return {
      name: "MA Crossover",
      rawScore: 0,
      normalizedScore: 0,
      direction: "neutral",
      meta: { error: "MA calculation failed" },
    };
  }

  const prevShort = prevShortMA ?? lastShortMA;
  const prevLong = prevLongMA ?? lastLongMA;
  const lastPrice = closes[closes.length - 1];

  // Calculate raw score as difference between MAs
  const rawScore = lastShortMA - lastLongMA;

  // Normalize by price
  const normalizedScore = (rawScore / lastPrice) * 100;

  // Determine direction based on crossover
  let direction: SignalDirection = "neutral";

  if (prevShort <= prevLong && lastShortMA > lastLongMA) {
    // Golden cross - bullish
    direction = "buy";
  } else if (prevShort >= prevLong && lastShortMA < lastLongMA) {
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
