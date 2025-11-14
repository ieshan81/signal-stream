import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();

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

    if (action === 'historical') {
      const cacheKey = `hist_${symbol}_${limit}`;
      const cached = getCached(cacheKey, 5 * 60 * 1000); // 5 min TTL
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const apiUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=${limit}`;
      console.log(`[Binance API] ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Transform Binance klines to PriceData format
      const priceData = data.map((kline: any[]) => ({
        date: new Date(kline[0]).toISOString().split('T')[0],
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
      }));

      setCache(cacheKey, priceData);

      return new Response(JSON.stringify(priceData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'current') {
      const cacheKey = `current_${symbol}`;
      const cached = getCached(cacheKey, 60 * 1000); // 1 min TTL
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Fetch both current price and 24h stats
      const [priceResponse, statsResponse] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`),
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
      ]);

      if (!priceResponse.ok || !statsResponse.ok) {
        throw new Error('Failed to fetch current price from Binance');
      }

      const priceData = await priceResponse.json();
      const statsData = await statsResponse.json();

      const result = {
        price: parseFloat(priceData.price),
        change: parseFloat(statsData.priceChange),
        changePercent: parseFloat(statsData.priceChangePercent),
      };

      setCache(cacheKey, result);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "historical" or "current"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Error]', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
