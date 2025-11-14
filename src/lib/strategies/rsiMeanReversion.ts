import { StrategySignal, SignalDirection, PriceData } from "../types";
import { calculateRSI } from "../data/fetchHistorical";

interface RSIParams {
  period?: number;
  oversold?: number;
  overbought?: number;
}

/**
 * RSI Mean Reversion Strategy
 * Generates buy signals when RSI is oversold
 * Generates sell signals when RSI is overbought
 */
export function rsiMeanReversionStrategy(
  data: PriceData[],
  params: RSIParams = {}
): StrategySignal {
  const period = params.period || 14;
  const oversold = params.oversold || 30;
  const overbought = params.overbought || 70;

  if (data.length < period + 1) {
    return {
      name: "RSI Mean Reversion",
      rawScore: 0,
      normalizedScore: 0,
      direction: "neutral",
      meta: { error: "Insufficient data" },
    };
  }

  const closes = data.map((d) => d.close);
  const rsi = calculateRSI(closes, period);

  // Get last valid RSI value
  const lastRSI = rsi[rsi.length - 1];

  if (isNaN(lastRSI)) {
    return {
      name: "RSI Mean Reversion",
      rawScore: 0,
      normalizedScore: 0,
      direction: "neutral",
      meta: { error: "RSI calculation failed" },
    };
  }

  // Calculate raw score based on distance from thresholds
  let rawScore = 0;
  let direction: SignalDirection = "neutral";

  if (lastRSI < oversold) {
    // Oversold - bullish
    rawScore = oversold - lastRSI;
    direction = "buy";
  } else if (lastRSI > overbought) {
    // Overbought - bearish
    rawScore = -(lastRSI - overbought);
    direction = "sell";
  } else {
    // Neutral zone
    rawScore = 0;
    direction = "neutral";
  }

  // Normalize score to approximately [-2, 2] range
  const normalizedScore = (rawScore / 50) * 2;

  return {
    name: "RSI Mean Reversion",
    rawScore,
    normalizedScore,
    direction,
    meta: {
      rsi: lastRSI.toFixed(2),
      period,
      oversold,
      overbought,
    },
  };
}
