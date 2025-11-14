/**
 * Calculate performance metrics for a backtest
 */

interface EquityPoint {
  date: string;
  value: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  cagr: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
}

/**
 * Calculate total return
 */
export function calculateTotalReturn(
  initialValue: number,
  finalValue: number
): number {
  return (finalValue - initialValue) / initialValue;
}

/**
 * Calculate Compound Annual Growth Rate (CAGR)
 */
export function calculateCAGR(
  initialValue: number,
  finalValue: number,
  years: number
): number {
  if (years <= 0 || initialValue <= 0) return 0;
  return Math.pow(finalValue / initialValue, 1 / years) - 1;
}

/**
 * Calculate Sharpe Ratio
 * Assumes risk-free rate of 0 for simplicity
 */
export function calculateSharpeRatio(equityCurve: EquityPoint[]): number {
  if (equityCurve.length < 2) return 0;

  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const ret = (equityCurve[i].value - equityCurve[i - 1].value) / equityCurve[i - 1].value;
    returns.push(ret);
  }

  if (returns.length === 0) return 0;

  // Calculate mean and std dev of returns
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  // Annualize (assuming daily data)
  const annualizedReturn = meanReturn * 252;
  const annualizedStdDev = stdDev * Math.sqrt(252);

  return annualizedReturn / annualizedStdDev;
}

/**
 * Calculate Maximum Drawdown
 */
export function calculateMaxDrawdown(equityCurve: EquityPoint[]): number {
  if (equityCurve.length === 0) return 0;

  let maxDrawdown = 0;
  let peak = equityCurve[0].value;

  for (const point of equityCurve) {
    if (point.value > peak) {
      peak = point.value;
    }

    const drawdown = (peak - point.value) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

/**
 * Calculate Win Rate
 */
export function calculateWinRate(returns: number[]): number {
  if (returns.length === 0) return 0;

  const wins = returns.filter((r) => r > 0).length;
  return wins / returns.length;
}

/**
 * Calculate all performance metrics at once
 */
export function calculatePerformanceMetrics(
  equityCurve: EquityPoint[],
  periodReturns: number[]
): PerformanceMetrics {
  if (equityCurve.length < 2) {
    return {
      totalReturn: 0,
      cagr: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
    };
  }

  const initialValue = equityCurve[0].value;
  const finalValue = equityCurve[equityCurve.length - 1].value;

  // Calculate years
  const startDate = new Date(equityCurve[0].date);
  const endDate = new Date(equityCurve[equityCurve.length - 1].date);
  const years = (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

  return {
    totalReturn: calculateTotalReturn(initialValue, finalValue),
    cagr: calculateCAGR(initialValue, finalValue, years),
    sharpeRatio: calculateSharpeRatio(equityCurve),
    maxDrawdown: calculateMaxDrawdown(equityCurve),
    winRate: calculateWinRate(periodReturns),
  };
}
