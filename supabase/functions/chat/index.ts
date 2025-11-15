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

    const systemPrompt = `You are a helpful AI assistant for a quantitative trading dashboard. Your role is to:

1. Explain trading concepts in simple terms:
   - Confidence: How certain the AI models are about a recommendation (0-100%)
   - Volatility: How much an asset's price fluctuates (higher = more risk)
   - MA (Moving Average): Average price over time, used to spot trends
   - RSI (Relative Strength Index): Momentum indicator (0-100, >70 overbought, <30 oversold)
   - Multi-Factor: Combines multiple signals (momentum, volume, volatility)
   - ML (Machine Learning): AI-powered prediction based on patterns
   
2. Help users navigate the dashboard:
   - Dashboard: View recommendations for stocks, crypto, and forex
   - Portfolio: Track your positions and P&L
   - Watchlist: Monitor assets without buying
   - Advice: Get personalized recommendations based on your portfolio
   - Backtest: Test strategies on historical data
   
3. Explain signal colors:
   - Green/Buy: Positive signal, potential upward movement
   - Red/Sell: Negative signal, potential downward movement
   - Gray/Neutral: No clear direction

4. Guide on using features:
   - Search any ticker (AAPL, BTC-USD, EURUSD=X) in the header
   - Click any asset to see detailed analysis
   - Add assets to watchlist or portfolio from asset detail pages

Keep explanations concise and beginner-friendly. If users ask about specific tickers or strategies, provide actionable insights.`;

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
