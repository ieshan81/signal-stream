import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_LIMIT_MS = 2000; // 2 seconds between calls (conservative)
const LONG_CACHE_TTL = 60 * 60 * 1000; // 60 minutes for historical data
const SHORT_CACHE_TTL = 1 * 60 * 1000; // 1 minute for current prices (crypto moves fast)

// In-memory cache for REAL crypto data only
const cache = new Map<string, { data: any; timestamp: number }>();
let lastCallTime = 0;

function getCached(key: string, ttlMs: number) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    console.log(`[Cache HIT] ${key}`);
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
  console.log(`[Cache SET] ${key}`);
}

async function callYahooFinance(url: string) {
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  
  if (timeSinceLastCall < RATE_LIMIT_MS) {
    const waitTime = RATE_LIMIT_MS - timeSinceLastCall;
    console.log(`[Rate Limit] Waiting ${waitTime}ms before API call`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastCallTime = Date.now();
  console.log(`[Yahoo Finance API] ${url}`);
  return fetch(url);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const symbol = url.searchParams.get('symbol');
    const limit = parseInt(url.searchParams.get('limit') || '365');

    if (!action || !symbol) {
      return new Response(
        JSON.stringify({ error: 'Missing action or symbol parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Request] action=${action}, symbol=${symbol}, limit=${limit}`);

    // Convert BTCUSDT format to BTC-USD for Yahoo Finance
    const yahooSymbol = symbol.replace('USDT', '-USD');

    if (action === 'historical') {
      const cacheKey = `hist_${yahooSymbol}_${limit}`;
      const cached = getCached(cacheKey, LONG_CACHE_TTL);
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'cache' }
        });
      }

      const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=${limit}d`;
      console.log(`[Yahoo Finance API] ${apiUrl}`);
      
      const response = await callYahooFinance(apiUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Yahoo Finance Error] ${response.status}: ${errorText}`);
        throw new Error(`Failed to fetch real crypto data for ${symbol} (${response.status}). NO MOCK DATA - Real data required.`);
      }

      const data = await response.json();

      if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
        console.error('[No Chart Data]', JSON.stringify(data, null, 2));
        throw new Error(`No real crypto data available for ${symbol}. Cannot proceed without real market data.`);
      }

      const result = data.chart.result[0];
      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];

      if (!timestamps || !quotes) {
        throw new Error(`Invalid data structure for ${symbol}. NO MOCK DATA.`);
      }

      // Transform Yahoo Finance data to PriceData format
      const priceData = timestamps.map((timestamp: number, i: number) => ({
        date: new Date(timestamp * 1000).toISOString().split('T')[0],
        open: quotes.open[i] || 0,
        high: quotes.high[i] || 0,
        low: quotes.low[i] || 0,
        close: quotes.close[i] || 0,
        volume: quotes.volume[i] || 0,
      })).filter((d: any) => d.close > 0); // Filter out invalid data points

      if (priceData.length === 0) {
        throw new Error(`No valid crypto price data for ${symbol}. NO MOCK DATA.`);
      }

      setCache(cacheKey, priceData);

      return new Response(JSON.stringify(priceData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'yahoo-finance' }
      });
    }

    if (action === 'current') {
      const cacheKey = `current_${yahooSymbol}`;
      const cached = getCached(cacheKey, SHORT_CACHE_TTL);
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'cache' }
        });
      }

      const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=2d`;
      const response = await callYahooFinance(apiUrl);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Yahoo Finance Error] ${response.status}: ${errorText}`);
        throw new Error(`Failed to fetch current crypto price for ${symbol}. NO MOCK DATA.`);
      }

      const data = await response.json();

      if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
        throw new Error(`No current crypto price data for ${symbol}. NO MOCK DATA.`);
      }

      const result = data.chart.result[0];
      const meta = result.meta;
      const quotes = result.indicators.quote[0];
      const timestamps = result.timestamp;

      if (!quotes || !timestamps || timestamps.length < 2) {
        throw new Error(`Insufficient crypto data for ${symbol}. NO MOCK DATA.`);
      }

      // Get last two data points for change calculation
      const lastIndex = timestamps.length - 1;
      const prevIndex = lastIndex - 1;

      const currentPrice = quotes.close[lastIndex] || meta.regularMarketPrice || 0;
      const previousClose = quotes.close[prevIndex] || meta.previousClose || currentPrice;

      const change = currentPrice - previousClose;
      const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

      const currentData = {
        price: currentPrice,
        change: change,
        changePercent: changePercent,
      };

      setCache(cacheKey, currentData);

      return new Response(JSON.stringify(currentData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'yahoo-finance' }
      });
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "historical" or "current"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CRITICAL ERROR]', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        critical: true,
        message: 'REAL CRYPTO DATA UNAVAILABLE - System will not provide mock data for trading safety'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
