import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_LIMIT_MS = 2000; // 2 seconds between calls (conservative)
const LONG_CACHE_TTL = 60 * 60 * 1000; // 60 minutes for historical data
const SHORT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes for current prices

// In-memory cache for REAL data only
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
    const ticker = url.searchParams.get('ticker');
    
    if (!action || !ticker) {
      return new Response(
        JSON.stringify({ error: 'Missing action or ticker parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate ticker format (alphanumeric, dashes, equals, dots, underscores)
    const tickerRegex = /^[A-Z0-9._=^-]{1,20}$/i;
    if (!tickerRegex.test(ticker)) {
      console.error(`[Invalid Ticker] ${ticker}`);
      return new Response(
        JSON.stringify({ error: 'Invalid ticker format. Use alphanumeric characters, dashes, dots, equals, or underscores (1-20 chars)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and parse days parameter
    const daysParam = url.searchParams.get('days') || '365';
    const days = parseInt(daysParam);
    if (isNaN(days) || days < 1 || days > 3650) {
      console.error(`[Invalid Days] ${daysParam}`);
      return new Response(
        JSON.stringify({ error: 'Invalid days parameter. Must be between 1 and 3650' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Request] action=${action}, ticker=${ticker}, days=${days}`);

    // URL encode ticker for safe API usage
    const symbol = encodeURIComponent(ticker);

    if (action === 'historical') {
      const cacheKey = `hist_${symbol}_${days}`;
      const cached = getCached(cacheKey, LONG_CACHE_TTL);
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'cache' }
        });
      }

      const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${days}d`;
      const response = await callYahooFinance(apiUrl);
      
      if (!response.ok) {
        console.error(`[Yahoo Finance Error] ${response.status}: ${response.statusText}`);
        throw new Error(`Failed to fetch real data for ${ticker} (${response.status}). NO MOCK DATA - Real data required.`);
      }

      const data = await response.json();

      if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
        console.error('[No Chart Data]', JSON.stringify(data, null, 2));
        throw new Error(`No real data available for ${ticker}. Cannot proceed without real market data.`);
      }

      const result = data.chart.result[0];
      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];

      if (!timestamps || !quotes) {
        throw new Error(`Invalid data structure for ${ticker}. NO MOCK DATA.`);
      }

      // Transform to PriceData format
      const priceData = timestamps.map((timestamp: number, i: number) => ({
        date: new Date(timestamp * 1000).toISOString().split('T')[0],
        open: quotes.open[i] || 0,
        high: quotes.high[i] || 0,
        low: quotes.low[i] || 0,
        close: quotes.close[i] || 0,
        volume: quotes.volume[i] || 0,
      })).filter((d: any) => d.close > 0); // Filter out invalid data points

      if (priceData.length === 0) {
        throw new Error(`No valid price data for ${ticker}. NO MOCK DATA.`);
      }

      setCache(cacheKey, priceData);

      return new Response(JSON.stringify(priceData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'yahoo-finance' }
      });
    }

    if (action === 'current') {
      const cacheKey = `current_${symbol}`;
      const cached = getCached(cacheKey, SHORT_CACHE_TTL);
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'cache' }
        });
      }

      const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`;
      const response = await callYahooFinance(apiUrl);

      if (!response.ok) {
        console.error(`[Yahoo Finance Error] ${response.status}: ${response.statusText}`);
        throw new Error(`Failed to fetch current price for ${ticker}. NO MOCK DATA.`);
      }

      const data = await response.json();

      if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
        throw new Error(`No current price data for ${ticker}. NO MOCK DATA.`);
      }

      const result = data.chart.result[0];
      const meta = result.meta;
      const quotes = result.indicators.quote[0];
      const timestamps = result.timestamp;

      if (!quotes || !timestamps || timestamps.length < 2) {
        throw new Error(`Insufficient data for ${ticker}. NO MOCK DATA.`);
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
        message: 'REAL DATA UNAVAILABLE - System will not provide mock data for trading safety'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
