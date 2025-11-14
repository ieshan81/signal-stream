import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALPHA_VANTAGE_API_KEY = Deno.env.get('ALPHA_VANTAGE_API_KEY');
const RATE_LIMIT_MS = 15000; // 15 seconds between calls (4 calls/min to be safe)
const LONG_CACHE_TTL = 30 * 60 * 1000; // 30 minutes for historical data
const SHORT_CACHE_TTL = 2 * 60 * 1000; // 2 minutes for current prices

// In-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
let lastCallTime = 0;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 3;

function getCached(key: string, ttlMs: number) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    console.log(`[Cache HIT] ${key}`);
    return cached.data;
  }
  // If rate limited, return stale cache if available
  if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS && cached) {
    console.log(`[Cache STALE] ${key} (returning due to rate limits)`);
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
  
  // Add exponential backoff if we're seeing errors
  const backoffMultiplier = Math.min(consecutiveErrors, 5);
  const effectiveRateLimit = RATE_LIMIT_MS * (1 + backoffMultiplier * 0.5);
  
  if (timeSinceLastCall < effectiveRateLimit) {
    const waitTime = effectiveRateLimit - timeSinceLastCall;
    console.log(`[Rate Limit] Waiting ${waitTime}ms before API call (errors: ${consecutiveErrors})`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastCallTime = Date.now();
  console.log(`[API Call] ${url.split('?')[0]}`);
  return fetch(url);
}

function generateMockHistoricalData(ticker: string, days: number): any[] {
  console.log(`[Mock Data] Generating for ${ticker}`);
  const basePrice = Math.random() * 200 + 50; // Random base price between 50-250
  const data = [];
  const now = Date.now();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const volatility = basePrice * 0.02; // 2% daily volatility
    const change = (Math.random() - 0.5) * 2 * volatility;
    const close = basePrice + change;
    
    data.push({
      date: dateStr,
      open: close * (1 + (Math.random() - 0.5) * 0.01),
      high: close * (1 + Math.random() * 0.02),
      low: close * (1 - Math.random() * 0.02),
      close: close,
      volume: Math.floor(Math.random() * 10000000) + 1000000,
    });
  }
  
  return data;
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
        consecutiveErrors = Math.max(0, consecutiveErrors - 1); // Decrease error count on cache hit
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // If too many consecutive errors, return mock data
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.log(`[Fallback] Using mock data for ${ticker} due to rate limits`);
        const mockData = generateMockHistoricalData(ticker, days);
        setCache(cacheKey, mockData);
        return new Response(JSON.stringify(mockData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'mock' }
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
        throw new Error('API rate limit reached. Please try again in 1 minute.');
      }

      if (data['Information']) {
        console.error('[API Info]', data['Information']);
        consecutiveErrors++;
        throw new Error('API call frequency exceeded. Please try again later.');
      }

      const timeSeries = data['Time Series (Daily)'];
      if (!timeSeries) {
        console.error('[No Time Series Data]', JSON.stringify(data, null, 2));
        consecutiveErrors++;
        throw new Error(`No data available for ${ticker}. API response: ${JSON.stringify(data).substring(0, 200)}`);
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

      consecutiveErrors = 0; // Reset error count on success
      setCache(cacheKey, priceData);

      return new Response(JSON.stringify(priceData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'alpha-vantage' }
      });
    }

    if (action === 'current') {
      const cacheKey = `current_${symbol}`;
      const cached = getCached(cacheKey, SHORT_CACHE_TTL);
      if (cached) {
        consecutiveErrors = Math.max(0, consecutiveErrors - 1);
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // If too many consecutive errors, return mock current price
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.log(`[Fallback] Using mock current price for ${ticker}`);
        const mockPrice = {
          price: Math.random() * 200 + 50,
          change: (Math.random() - 0.5) * 10,
          changePercent: (Math.random() - 0.5) * 5,
        };
        setCache(cacheKey, mockPrice);
        return new Response(JSON.stringify(mockPrice), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'mock' }
        });
      }

      const apiUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
      const response = await callAlphaVantage(apiUrl);
      const data = await response.json();

      if (data['Error Message']) {
        throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
      }

      if (data['Note']) {
        throw new Error('API rate limit reached. Please try again in 1 minute.');
      }

      const quote = data['Global Quote'];
      if (!quote || !quote['05. price']) {
        throw new Error(`No price data available for ${ticker}`);
      }

      const result = {
        price: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
      };

      consecutiveErrors = 0; // Reset on success
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
    console.error('[Error]', error);
    consecutiveErrors++;
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // If we're rate limited, suggest using cached/mock data
    const isRateLimited = errorMessage.includes('frequency') || errorMessage.includes('rate limit');
    const suggestion = isRateLimited 
      ? ' Dashboard will use cached/mock data until rate limits reset.'
      : '';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage + suggestion,
        consecutiveErrors,
        fallbackAvailable: consecutiveErrors >= MAX_CONSECUTIVE_ERRORS
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
