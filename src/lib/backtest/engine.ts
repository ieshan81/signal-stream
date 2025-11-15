import { BacktestConfig, BacktestResult } from "../types";
import { supabase } from "@/integrations/supabase/client";

/**
 * Runs a backtest simulation via edge function
 * This is now a thin client that calls the backend for heavy computation
 */
export async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
  // Validate configuration
  validateBacktestConfig(config);

  console.log('Calling backtest edge function with config:', config);

  // Call the edge function to run the backtest on the server
  const { data, error } = await supabase.functions.invoke('backtest', {
    body: { config }
  });

  if (error) {
    console.error('Backtest edge function error:', error);
    throw new Error(error.message || 'Failed to run backtest');
  }

  if (!data) {
    throw new Error('No data returned from backtest');
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data as BacktestResult;
}

/**
 * Validate backtest configuration
 */
function validateBacktestConfig(config: BacktestConfig): void {
  if (!config.tickers || config.tickers.length === 0) {
    throw new Error('At least one ticker is required');
  }

  if (config.tickers.length > 10) {
    throw new Error('Maximum 10 tickers allowed to prevent performance issues');
  }

  // Filter out empty tickers
  config.tickers = config.tickers.filter(t => t.trim().length > 0);

  if (!config.strategies || config.strategies.length === 0) {
    throw new Error('At least one strategy must be selected');
  }

  const startDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);
  const now = new Date();

  if (isNaN(startDate.getTime())) {
    throw new Error('Invalid start date');
  }

  if (isNaN(endDate.getTime())) {
    throw new Error('Invalid end date');
  }

  if (endDate <= startDate) {
    throw new Error('End date must be after start date');
  }

  if (endDate > now) {
    throw new Error('End date cannot be in the future');
  }

  const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff > 730) {
    throw new Error('Maximum backtest period is 2 years (730 days)');
  }

  if (config.initialCapital <= 0) {
    throw new Error('Initial capital must be greater than 0');
  }

  if (config.rebalancePeriod <= 0) {
    throw new Error('Rebalance period must be greater than 0');
  }
}
