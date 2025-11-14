import { StrategySignal, SignalDirection, PriceData } from "../types";
import { calculateReturns, calculateVolatility } from "../data/fetchHistorical";

interface MultiFactorParams {
  momentumPeriod?: number;
  volatilityPeriod?: number;
  momentumWeight?: number;
  volatilityWeight?: number;
}

/**
 * Multi-Factor Strategy
 * Combines momentum and volatility factors
 * High momentum + low volatility = bullish
 * Low momentum + high volatility = bearish
 */
export function multiFactorStrategy(
  data: PriceData[],
  params: MultiFactorParams = {}
): StrategySignal {
  const momentumPeriod = params.momentumPeriod || 126; // ~6 months
  const volatilityPeriod = params.volatilityPeriod || 60; // ~3 months
  const momentumWeight = params.momentumWeight || 0.7;
  const volatilityWeight = params.volatilityWeight || 0.3;

  if (data.length < momentumPeriod) {
    return {
      name: "Multi-Factor",
      rawScore: 0,
      normalizedScore: 0,
      direction: "neutral",
      meta: { error: "Insufficient data" },
    };
  }

  const closes = data.map((d) => d.close);

  // Calculate Momentum (6-month return)
  const currentPrice = closes[closes.length - 1];
  const oldPrice = closes[closes.length - momentumPeriod - 1];
  const momentum = (currentPrice - oldPrice) / oldPrice;

  // Calculate Volatility (annualized)
  const volatility = calculateVolatility(closes, volatilityPeriod);

  // Z-score approximation
  // For momentum: higher is better, so positive z-score is bullish
  const momentumZScore = momentum / 0.3; // Approximate normalization

  // For volatility: lower is better, so negative z-score of volatility is bullish
  const volatilityZScore = -(volatility - 0.25) / 0.15; // Approximate normalization

  // Combine factors
  const combinedScore = momentumWeight * momentumZScore + volatilityWeight * volatilityZScore;

  // Determine direction
  let direction: SignalDirection = "neutral";
  if (combinedScore > 0.5) {
    direction = "buy";
  } else if (combinedScore < -0.5) {
    direction = "sell";
  }

  return {
    name: "Multi-Factor",
    rawScore: combinedScore,
    normalizedScore: Math.max(-2, Math.min(2, combinedScore)),
    direction,
    meta: {
      momentum: (momentum * 100).toFixed(2) + "%",
      volatility: (volatility * 100).toFixed(2) + "%",
      momentumZScore: momentumZScore.toFixed(2),
      volatilityZScore: volatilityZScore.toFixed(2),
    },
  };
}
