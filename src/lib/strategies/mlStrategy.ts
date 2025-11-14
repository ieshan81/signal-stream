import { StrategySignal, SignalDirection, PriceData } from "../types";
import { calculateRSI, calculateReturns, calculateVolatility } from "../data/fetchHistorical";

/**
 * ML Strategy (Placeholder with Fixed Coefficients)
 * Uses a simple linear model with predefined weights
 * Features: RSI, short-term momentum, volatility
 * In production, this would be replaced with a trained model
 */
export function mlStrategy(data: PriceData[]): StrategySignal {
  if (data.length < 60) {
    return {
      name: "ML Strategy",
      rawScore: 0,
      normalizedScore: 0,
      direction: "neutral",
      meta: { error: "Insufficient data" },
    };
  }

  const closes = data.map((d) => d.close);

  // Feature 1: RSI (normalized to [0, 1])
  const rsi = calculateRSI(closes, 14);
  const lastRSI = rsi[rsi.length - 1];
  const rsiNorm = isNaN(lastRSI) ? 0.5 : lastRSI / 100;

  // Feature 2: Short-term momentum (10-day return)
  const currentPrice = closes[closes.length - 1];
  const oldPrice = closes[closes.length - 11];
  const shortMomentum = (currentPrice - oldPrice) / oldPrice;

  // Feature 3: Volatility (30-day)
  const volatility = calculateVolatility(closes, 30);

  // Fixed model coefficients (placeholder)
  const w0 = 0.1; // Bias
  const w1 = -0.5; // RSI weight (inverted - low RSI is bullish)
  const w2 = 2.0; // Momentum weight
  const w3 = -1.0; // Volatility weight (high vol is bearish)

  // Linear combination
  const rawScore = w0 + w1 * rsiNorm + w2 * shortMomentum + w3 * volatility;

  // Apply sigmoid to get probability
  const probability = 1 / (1 + Math.exp(-rawScore));

  // Determine direction based on probability
  let direction: SignalDirection = "neutral";
  if (probability > 0.6) {
    direction = "buy";
  } else if (probability < 0.4) {
    direction = "sell";
  }

  // Normalize to [-2, 2] range
  const normalizedScore = (probability - 0.5) * 4;

  return {
    name: "ML Strategy",
    rawScore,
    normalizedScore,
    direction,
    meta: {
      probability: probability.toFixed(3),
      rsi: lastRSI.toFixed(2),
      momentum: (shortMomentum * 100).toFixed(2) + "%",
      volatility: (volatility * 100).toFixed(2) + "%",
    },
  };
}
