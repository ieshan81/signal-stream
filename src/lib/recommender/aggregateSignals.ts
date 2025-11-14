import {
  StrategySignal,
  AssetRecommendation,
  RecommendationType,
  AssetType,
  StrategyWeights,
  DEFAULT_WEIGHTS,
} from "../types";

/**
 * Aggregates multiple strategy signals into a single recommendation
 */
export function aggregateSignals(
  ticker: string,
  assetType: AssetType,
  currentPrice: number,
  priceChangePct: number,
  volatility: number,
  signals: StrategySignal[],
  weights: StrategyWeights = DEFAULT_WEIGHTS
): AssetRecommendation {
  // Create signal map
  const signalMap: Record<string, StrategySignal> = {};
  signals.forEach((signal) => {
    const key = signal.name.toLowerCase().replace(/\s+/g, "_");
    signalMap[key] = signal;
  });

  // Calculate weighted score
  let weightedScore = 0;
  let totalWeight = 0;

  Object.entries(weights).forEach(([strategyKey, weight]) => {
    const signal = signalMap[strategyKey];
    if (signal) {
      weightedScore += weight * signal.normalizedScore;
      totalWeight += weight;
    }
  });

  const combinedScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

  // Determine recommendation
  let recommendation: RecommendationType = "HOLD";
  if (combinedScore >= 0.5) {
    recommendation = "BUY";
  } else if (combinedScore <= -0.5) {
    recommendation = "SELL";
  }

  // Calculate confidence
  const confidence = calculateConfidence(signals, combinedScore, volatility);

  return {
    ticker,
    assetType,
    recommendation,
    score: combinedScore,
    confidence,
    volatility,
    currentPrice,
    priceChangePct,
    contributingSignals: signalMap,
  };
}

/**
 * Calculates confidence score based on signal agreement and volatility
 */
function calculateConfidence(
  signals: StrategySignal[],
  combinedScore: number,
  volatility: number
): number {
  if (signals.length === 0) return 0;

  // Factor 1: Magnitude of combined score
  const scoreMagnitude = Math.abs(combinedScore);
  const scoreFactor = Math.min(scoreMagnitude / 2, 1) * 40; // 0-40 points

  // Factor 2: Agreement between strategies
  const buyCount = signals.filter((s) => s.direction === "buy").length;
  const sellCount = signals.filter((s) => s.direction === "sell").length;
  const neutralCount = signals.filter((s) => s.direction === "neutral").length;

  const maxCount = Math.max(buyCount, sellCount, neutralCount);
  const agreementRatio = maxCount / signals.length;
  const agreementFactor = agreementRatio * 40; // 0-40 points

  // Factor 3: Volatility penalty
  const volatilityPenalty = Math.min(volatility * 100, 20); // 0-20 points penalty
  const volatilityFactor = 20 - volatilityPenalty; // 0-20 points

  // Combine factors
  const confidence = scoreFactor + agreementFactor + volatilityFactor;

  // Ensure confidence is in [0, 100] range
  return Math.max(0, Math.min(100, confidence));
}

/**
 * Ranks recommendations by combined score (absolute value)
 */
export function rankRecommendations(
  recommendations: AssetRecommendation[]
): AssetRecommendation[] {
  return [...recommendations].sort((a, b) => {
    // Primary sort: absolute score (stronger signals first)
    const scoreCompare = Math.abs(b.score) - Math.abs(a.score);
    if (Math.abs(scoreCompare) > 0.01) return scoreCompare;

    // Secondary sort: confidence
    return b.confidence - a.confidence;
  });
}
