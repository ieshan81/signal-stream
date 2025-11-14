import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 2; // Fail fast to mock data

function getCached(key: string, ttlMs: number) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    console.log(`[Cache HIT] ${key}`);
    return cached.data;
  }
  // Return stale cache if we're having issues
  if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS && cached) {
    console.log(`[Cache STALE] ${key} (returning due to errors)`);
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
  console.log(`[Cache SET] ${key}`);
}

function generateMockCryptoData(symbol: string, limit: number): any[] {
  console.log(`[Mock Crypto Data] Generating for ${symbol}`);
  const basePrice = symbol.includes('BTC') ? 45000 : 
                    symbol.includes('ETH') ? 2500 : 
                    symbol.includes('SOL') ? 100 :
                    symbol.includes('BNB') ? 300 : 50;
  
  const data = [];
  const now = Date.now();
  
  for (let i = limit - 1; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const volatility = basePrice * 0.03; // 3% daily volatility for crypto
    const change = (Math.random() - 0.5) * 2 * volatility;
    const close = basePrice * (1 + (Math.random() - 0.5) * 0.1); // More volatile
    
    data.push({
      date: dateStr,
      open: close * (1 + (Math.random() - 0.5) * 0.02),
      high: close * (1 + Math.random() * 0.03),
      low: close * (1 - Math.random() * 0.03),
      close: close,
      volume: Math.floor(Math.random() * 100000000) + 10000000,
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
        consecutiveErrors = Math.max(0, consecutiveErrors - 1);
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // If we've had errors or Binance is blocked, use mock data
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.log(`[Fallback] Using mock crypto data for ${symbol}`);
        const mockData = generateMockCryptoData(symbol, limit);
        setCache(cacheKey, mockData);
        return new Response(JSON.stringify(mockData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'mock' }
        });
      }

      try {
        const apiUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=${limit}`;
        console.log(`[Binance API] ${apiUrl}`);
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Binance Error] ${response.status}: ${errorText}`);
          
          // If geo-blocked or unavailable, increment errors and return mock
          if (response.status === 451 || response.status === 403) {
            consecutiveErrors = MAX_CONSECUTIVE_ERRORS; // Immediately switch to mock
            console.log(`[Binance Blocked] Using mock data for ${symbol}`);
            const mockData = generateMockCryptoData(symbol, limit);
            setCache(cacheKey, mockData);
            return new Response(JSON.stringify(mockData), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'mock' }
            });
          }
          
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

        consecutiveErrors = 0; // Reset on success
        setCache(cacheKey, priceData);

        return new Response(JSON.stringify(priceData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'binance' }
        });
      } catch (binanceError) {
        consecutiveErrors++;
        console.error('[Binance Fetch Error]', binanceError);
        
        // Fall back to mock data
        const mockData = generateMockCryptoData(symbol, limit);
        setCache(cacheKey, mockData);
        return new Response(JSON.stringify(mockData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'mock' }
        });
      }
    }

    if (action === 'current') {
      const cacheKey = `current_${symbol}`;
      const cached = getCached(cacheKey, 60 * 1000); // 1 min TTL
      if (cached) {
        consecutiveErrors = Math.max(0, consecutiveErrors - 1);
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // If errors, use mock data
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        const basePrice = symbol.includes('BTC') ? 45000 : 
                          symbol.includes('ETH') ? 2500 : 
                          symbol.includes('SOL') ? 100 : 50;
        const mockPrice = {
          price: basePrice * (1 + (Math.random() - 0.5) * 0.02),
          change: (Math.random() - 0.5) * basePrice * 0.05,
          changePercent: (Math.random() - 0.5) * 5,
        };
        setCache(cacheKey, mockPrice);
        return new Response(JSON.stringify(mockPrice), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'mock' }
        });
      }

      try {
        // Fetch both current price and 24h stats
        const [priceResponse, statsResponse] = await Promise.all([
          fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`),
          fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
        ]);

        if (!priceResponse.ok || !statsResponse.ok) {
          if (priceResponse.status === 451 || priceResponse.status === 403 ||
              statsResponse.status === 451 || statsResponse.status === 403) {
            consecutiveErrors = MAX_CONSECUTIVE_ERRORS;
          }
          throw new Error('Failed to fetch current price from Binance');
        }

        const priceData = await priceResponse.json();
        const statsData = await statsResponse.json();

        const result = {
          price: parseFloat(priceData.price),
          change: parseFloat(statsData.priceChange),
          changePercent: parseFloat(statsData.priceChangePercent),
        };

        consecutiveErrors = 0;
        setCache(cacheKey, result);

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'binance' }
        });
      } catch (binanceError) {
        consecutiveErrors++;
        
        // Return mock price
        const basePrice = symbol.includes('BTC') ? 45000 : 
                          symbol.includes('ETH') ? 2500 : 
                          symbol.includes('SOL') ? 100 : 50;
        const mockPrice = {
          price: basePrice * (1 + (Math.random() - 0.5) * 0.02),
          change: (Math.random() - 0.5) * basePrice * 0.05,
          changePercent: (Math.random() - 0.5) * 5,
        };
        setCache(cacheKey, mockPrice);
        return new Response(JSON.stringify(mockPrice), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Data-Source': 'mock' }
        });
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "historical" or "current"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Error]', error);
    consecutiveErrors++;
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        fallbackAvailable: true,
        message: 'Using simulated crypto data'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
