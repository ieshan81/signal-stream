import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALPHA_VANTAGE_API_KEY = Deno.env.get('ALPHA_VANTAGE_API_KEY');
const RATE_LIMIT_MS = 20000; // 20 seconds between calls (3 calls/min)
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

async function callAlphaVantage(url: string) {
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  
  if (timeSinceLastCall < RATE_LIMIT_MS) {
    const waitTime = RATE_LIMIT_MS - timeSinceLastCall;
    console.log(`[Rate Limit] Waiting ${waitTime}ms before API call`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastCallTime = Date.now();
  console.log(`[API Call] ${url.split('?')[0]}`);
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
    const days = parseInt(url.searchParams.get('days') || '365');

    if (!action || !ticker) {
      return new Response(
        JSON.stringify({ error: 'Missing action or ticker parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Request] action=${action}, ticker=${ticker}, days=${days}`);

    // Handle forex ticker format (EURUSD=X -> EUR/USD)
    const symbol = ticker.includes('=X') 
      ? ticker.replace('=X', '').replace(/(.{3})(.{3})/, '$1/$2')
      : ticker;

    if (action === 'historical') {
      const cacheKey = `hist_${symbol}_${days}`;
      const cached = getCached(cacheKey, LONG_CACHE_TTL);
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'cache' }
        });
      }

      const apiUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`;
      const response = await callAlphaVantage(apiUrl);
      const data = await response.json();

      console.log(`[Alpha Vantage Response Keys]`, Object.keys(data));

      if (data['Error Message']) {
        throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
      }

      if (data['Note']) {
        console.error('[Rate Limit]', data['Note']);
        throw new Error('API rate limit reached. Please wait 1 minute and try again. NO MOCK DATA - REAL DATA ONLY.');
      }

      if (data['Information']) {
        console.error('[API Info]', data['Information']);
        throw new Error('API call frequency exceeded. Please wait and try again. NO MOCK DATA - REAL DATA ONLY.');
      }

      const timeSeries = data['Time Series (Daily)'];
      if (!timeSeries) {
        console.error('[No Time Series Data]', JSON.stringify(data, null, 2));
        throw new Error(`No real data available for ${ticker}. Cannot proceed without real market data.`);
      }

      // Transform to PriceData format
      const priceData = Object.entries(timeSeries)
        .slice(0, days)
        .map(([date, values]: [string, any]) => ({
          date,
          open: parseFloat(values['1. open']),
          high: parseFloat(values['2. high']),
          low: parseFloat(values['3. low']),
          close: parseFloat(values['4. close']),
          volume: parseInt(values['6. volume']),
        }))
        .reverse();

      setCache(cacheKey, priceData);

      return new Response(JSON.stringify(priceData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'alpha-vantage' }
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

      const apiUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
      const response = await callAlphaVantage(apiUrl);
      const data = await response.json();

      if (data['Error Message']) {
        throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
      }

      if (data['Note']) {
        throw new Error('API rate limit reached. Please wait 1 minute. NO MOCK DATA - REAL DATA ONLY.');
      }

      const quote = data['Global Quote'];
      if (!quote || !quote['05. price']) {
        throw new Error(`No real price data available for ${ticker}. Cannot proceed without real market data.`);
      }

      const result = {
        price: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
      };

      setCache(cacheKey, result);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'alpha-vantage' }
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
