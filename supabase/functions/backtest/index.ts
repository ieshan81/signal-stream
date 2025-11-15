import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface BacktestConfig {
  tickers: string[];
  assetType: 'stocks' | 'crypto' | 'forex';
  strategies: string[];
  startDate: string;
  endDate: string;
  rebalancePeriod: number;
  initialCapital: number;
}

interface Trade {
  date: string;
  ticker: string;
  action: 'buy' | 'sell';
  price: number;
  quantity: number;
  value: number;
}

interface StrategySignal {
  name: string;
  rawScore: number;
  normalizedScore: number;
  direction: 'buy' | 'sell' | 'neutral';
  meta?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { config } = await req.json() as { config: BacktestConfig };

    // Validation
    if (!config.tickers || config.tickers.length === 0) {
      throw new Error('At least one ticker is required');
    }
    if (config.tickers.length > 10) {
      throw new Error('Maximum 10 tickers allowed');
    }
    if (!config.strategies || config.strategies.length === 0) {
      throw new Error('At least one strategy is required');
    }
    if (new Date(config.endDate) <= new Date(config.startDate)) {
      throw new Error('End date must be after start date');
    }
    if (new Date(config.endDate) > new Date()) {
      throw new Error('End date cannot be in the future');
    }

    console.log('Starting backtest:', {
      tickers: config.tickers,
      strategies: config.strategies,
      dateRange: `${config.startDate} to ${config.endDate}`
    });

    // Fetch historical data for all tickers
    const tickerDataMap: Record<string, PriceData[]> = {};
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    for (const ticker of config.tickers) {
      try {
        let url: string;
        if (config.assetType === 'crypto') {
          const symbol = ticker.replace('-USD', 'USDT');
          url = `${supabaseUrl}/functions/v1/crypto-data?action=historical&symbol=${symbol}&limit=400`;
        } else {
          url = `${supabaseUrl}/functions/v1/market-data?action=historical&ticker=${ticker}&days=400`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok || data.error || !Array.isArray(data)) {
          console.warn(`Failed to fetch data for ${ticker}:`, data.error || 'Invalid response');
          continue;
        }

        const filteredData = data
          .filter((d: PriceData) => d.date >= config.startDate && d.date <= config.endDate && d.close > 0);
        
        if (filteredData.length > 0) {
          tickerDataMap[ticker] = filteredData;
        }
      } catch (error) {
        console.warn(`Error fetching ${ticker}:`, error);
      }
    }

    if (Object.keys(tickerDataMap).length === 0) {
      throw new Error('No valid data available for any ticker');
    }

    // Get all unique dates
    const allDates = new Set<string>();
    Object.values(tickerDataMap).forEach((data) => {
      data.forEach((d) => allDates.add(d.date));
    });
    const sortedDates = Array.from(allDates).sort();

    // Initialize portfolio
    let cash = config.initialCapital;
    let holdings: Record<string, number> = {};
    const equityCurve: { date: string; value: number }[] = [];
    const trades: Trade[] = [];
    const periodReturns: number[] = [];

    let lastRebalanceDate = sortedDates[0];
    let portfolioValueAtLastRebalance = config.initialCapital;

    // Run backtest
    for (let i = 0; i < sortedDates.length; i++) {
      const date = sortedDates[i];
      const daysSinceRebalance = Math.floor(
        (new Date(date).getTime() - new Date(lastRebalanceDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceRebalance >= config.rebalancePeriod || i === 0) {
        const currentPortfolioValue = calculatePortfolioValue(cash, holdings, tickerDataMap, date);

        if (i > 0) {
          const periodReturn = (currentPortfolioValue - portfolioValueAtLastRebalance) / portfolioValueAtLastRebalance;
          periodReturns.push(periodReturn);
        }

        // Sell all holdings
        for (const [ticker, quantity] of Object.entries(holdings)) {
          const price = getPriceAtDate(tickerDataMap[ticker], date);
          if (price > 0) {
            const saleValue = quantity * price;
            cash += saleValue;
            trades.push({ date, ticker, action: 'sell', price, quantity, value: saleValue });
          }
        }
        holdings = {};

        // Generate recommendations
        const recommendations = generateRecommendations(
          config.tickers,
          config.assetType,
          tickerDataMap,
          date,
          config.strategies
        );

        const buyRecommendations = recommendations
          .filter((r) => r.recommendation === 'BUY')
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

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
                trades.push({ date, ticker: rec.ticker, action: 'buy', price, quantity, value: purchaseValue });
              }
            }
          }
        }

        lastRebalanceDate = date;
        portfolioValueAtLastRebalance = calculatePortfolioValue(cash, holdings, tickerDataMap, date);
      }

      const portfolioValue = calculatePortfolioValue(cash, holdings, tickerDataMap, date);
      equityCurve.push({ date, value: portfolioValue });
    }

    // Calculate metrics
    const metrics = calculatePerformanceMetrics(equityCurve, periodReturns);

    console.log('Backtest completed:', { metrics, totalTrades: trades.length });

    return new Response(
      JSON.stringify({ equityCurve, metrics, trades }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Backtest error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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

function getPriceAtDate(data: PriceData[], date: string): number {
  const point = data.find((d) => d.date === date);
  return point ? point.close : 0;
}

function generateRecommendations(
  tickers: string[],
  assetType: string,
  tickerDataMap: Record<string, PriceData[]>,
  date: string,
  strategies: string[]
) {
  const recommendations = [];

  for (const ticker of tickers) {
    const data = tickerDataMap[ticker];
    if (!data || data.length === 0) continue;

    const historicalData = data.filter((d) => d.date <= date);
    if (historicalData.length < 200) continue;

    const currentPrice = getPriceAtDate(data, date);
    if (currentPrice === 0) continue;

    const prevPrice = historicalData.length > 1 ? historicalData[historicalData.length - 2].close : currentPrice;
    const priceChangePct = ((currentPrice - prevPrice) / prevPrice) * 100;

    const signals: StrategySignal[] = [];
    
    // Simple MA Crossover
    if (strategies.includes('ma_crossover')) {
      const closes = historicalData.map(d => d.close);
      const sma20 = calculateSMA(closes, 20);
      const sma50 = calculateSMA(closes, 50);
      const score = sma20[sma20.length - 1] > sma50[sma50.length - 1] ? 1 : -1;
      signals.push({
        name: 'ma_crossover',
        rawScore: score,
        normalizedScore: score,
        direction: score > 0 ? 'buy' : 'sell'
      });
    }

    // RSI Mean Reversion
    if (strategies.includes('rsi_mean_reversion')) {
      const closes = historicalData.map(d => d.close);
      const rsi = calculateRSI(closes, 14);
      const currentRSI = rsi[rsi.length - 1];
      const score = currentRSI < 30 ? 1 : currentRSI > 70 ? -1 : 0;
      signals.push({
        name: 'rsi_mean_reversion',
        rawScore: score,
        normalizedScore: score,
        direction: score > 0 ? 'buy' : score < 0 ? 'sell' : 'neutral'
      });
    }

    // Aggregate signals
    const avgScore = signals.reduce((sum, s) => sum + s.normalizedScore, 0) / signals.length;
    const recommendation = avgScore > 0.2 ? 'BUY' : avgScore < -0.2 ? 'SELL' : 'HOLD';

    recommendations.push({
      ticker,
      assetType,
      recommendation,
      score: avgScore,
      confidence: Math.abs(avgScore) * 50,
      volatility: 0,
      currentPrice,
      priceChangePct,
      contributingSignals: signals.reduce((acc, s) => ({ ...acc, [s.name]: s }), {})
    });
  }

  return recommendations;
}

function calculateSMA(data: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(0);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

function calculateRSI(closes: number[], period: number): number[] {
  const rsi: number[] = [];
  const changes: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  for (let i = 0; i < changes.length; i++) {
    if (i < period) {
      rsi.push(50);
    } else {
      const recentChanges = changes.slice(i - period, i);
      const gains = recentChanges.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
      const losses = Math.abs(recentChanges.filter(c => c < 0).reduce((a, b) => a + b, 0)) / period;
      const rs = losses === 0 ? 100 : gains / losses;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }

  return rsi;
}

function calculatePerformanceMetrics(
  equityCurve: { date: string; value: number }[],
  periodReturns: number[]
) {
  if (equityCurve.length === 0) {
    return { totalReturn: 0, cagr: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0 };
  }

  const initialValue = equityCurve[0].value;
  const finalValue = equityCurve[equityCurve.length - 1].value;
  const totalReturn = ((finalValue - initialValue) / initialValue) * 100;

  const startDate = new Date(equityCurve[0].date);
  const endDate = new Date(equityCurve[equityCurve.length - 1].date);
  const years = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
  const cagr = years > 0 ? (Math.pow(finalValue / initialValue, 1 / years) - 1) * 100 : 0;

  const avgReturn = periodReturns.length > 0 
    ? periodReturns.reduce((a, b) => a + b, 0) / periodReturns.length 
    : 0;
  const stdDev = periodReturns.length > 1
    ? Math.sqrt(periodReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / periodReturns.length)
    : 0;
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(12) : 0;

  let maxDrawdown = 0;
  let peak = equityCurve[0].value;
  for (const point of equityCurve) {
    if (point.value > peak) peak = point.value;
    const drawdown = ((peak - point.value) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const winRate = periodReturns.length > 0
    ? (periodReturns.filter(r => r > 0).length / periodReturns.length) * 100
    : 0;

  return { totalReturn, cagr, sharpeRatio, maxDrawdown, winRate };
}
