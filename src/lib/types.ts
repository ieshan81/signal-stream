// Core type definitions for the trading system

export type AssetType = "stocks" | "crypto" | "forex";

export type RecommendationType = "BUY" | "SELL" | "HOLD";

export type SignalDirection = "buy" | "sell" | "neutral";

export interface StrategySignal {
  name: string;
  rawScore: number;
  normalizedScore: number;
  direction: SignalDirection;
  meta?: Record<string, any>;
}

export interface AssetRecommendation {
  ticker: string;
  assetType: AssetType;
  recommendation: RecommendationType;
  score: number;
  confidence: number; // 0-100
  volatility: number;
  currentPrice: number;
  priceChangePct: number;
  contributingSignals: Record<string, StrategySignal>;
}

export interface PriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BacktestConfig {
  tickers: string[];
  assetType: AssetType;
  strategies: string[];
  startDate: string;
  endDate: string;
  rebalancePeriod: number; // days
  initialCapital: number;
}

export interface BacktestResult {
  equityCurve: { date: string; value: number }[];
  metrics: {
    totalReturn: number;
    cagr: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
  };
  trades: Trade[];
}

export interface Trade {
  date: string;
  ticker: string;
  action: "buy" | "sell";
  price: number;
  quantity: number;
  value: number;
}

export interface StrategyWeights {
  ma_crossover: number;
  rsi_mean_reversion: number;
  multi_factor: number;
  ml_strategy: number;
}

export const DEFAULT_WEIGHTS: StrategyWeights = {
  ma_crossover: 1.0,
  rsi_mean_reversion: 1.0,
  multi_factor: 1.0,
  ml_strategy: 0.5,
};
