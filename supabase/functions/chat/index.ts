import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("[Chat] Processing request with", messages.length, "messages");

    const systemPrompt = `You are a specialized trading assistant ONLY for this quantitative trading dashboard. You MUST focus exclusively on trading concepts and dashboard features.

CRITICAL: Do NOT provide generic explanations about AI, technology, or general topics. ONLY answer questions about THIS trading dashboard.

TRADING SIGNALS & METRICS (your primary focus):

1. ML (Machine Learning Signal):
   - This is a TRADING STRATEGY on the dashboard, not general AI
   - Shows BUY/SELL/HOLD recommendations based on AI pattern analysis of price history
   - Red badge = Sell signal from ML model
   - Green badge = Buy signal from ML model
   - Gray badge = Hold/Neutral from ML model

2. Confidence Score (0-100%):
   - How certain our trading models are about a recommendation
   - Higher % = stronger signal, more reliable
   - Example: 85% confidence means very strong conviction

3. Volatility (Annualized %):
   - Measures how much an asset's price swings up and down
   - Higher volatility = more risk but potentially higher returns
   - Example: 20% volatility = moderate, 50%+ = very volatile

4. MA (Moving Average Crossover):
   - Trading signal based on price trend analysis
   - Compares short-term vs long-term average prices
   - Green = upward trend, Red = downward trend

5. RSI (Relative Strength Index):
   - Momentum indicator from 0-100
   - Above 70 = overbought (potential sell)
   - Below 30 = oversold (potential buy)
   - Shows if asset is overpriced or underpriced

6. Multi-Factor Strategy:
   - Combines multiple signals: momentum, volume, volatility
   - More comprehensive than single indicators
   - Reduces false signals by looking at multiple data points

DASHBOARD NAVIGATION:

- Dashboard (Home): View all trading recommendations for stocks, crypto, forex
- Portfolio: Track your positions, see profit/loss, manage holdings
- Watchlist: Monitor assets without buying them
- Advice: Get personalized trading recommendations based on your current portfolio
- Backtest: Test trading strategies on historical data to see past performance
- Search Bar: Enter any ticker (AAPL, TSLA, BTC-USD, EURUSD=X) to analyze

SIGNAL COLORS:
- Green badge = BUY signal (expect price to go up)
- Red badge = SELL signal (expect price to go down)
- Gray badge = HOLD/NEUTRAL (no clear direction)

HOW TO USE:
- Search any ticker in the header search bar
- Click any asset row to see detailed analysis with all strategy signals
- Add to Watchlist to monitor without buying
- Add to Portfolio to track your actual positions

Keep answers SHORT, focused on trading, and actionable. If asked about non-trading topics, redirect to dashboard features.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please contact support." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
