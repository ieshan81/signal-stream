import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClientSubscription {
  socket: WebSocket;
  tickers: Set<string>;
  baselinePrices: Map<string, number>;
}

const clients = new Set<ClientSubscription>();
const binanceConnections = new Map<string, WebSocket>();

function toBinanceSymbol(ticker: string): string {
  // BTC-USD -> BTCUSDT
  return ticker.replace('-USD', 'USDT').replace('-USDT', 'USDT');
}

function fromBinanceSymbol(symbol: string): string {
  // BTCUSDT -> BTC-USD
  return symbol.replace('USDT', '-USD');
}

function connectToBinance(symbol: string) {
  if (binanceConnections.has(symbol)) {
    return; // Already connected
  }

  console.log(`[Binance] Connecting to ${symbol}`);
  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`);
  
  ws.onopen = () => {
    console.log(`[Binance] Connected to ${symbol}`);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const price = parseFloat(data.p);
      const timestamp = data.T;
      const ticker = fromBinanceSymbol(data.s);

      // Broadcast to all subscribed clients
      clients.forEach(client => {
        if (client.tickers.has(ticker) && client.socket.readyState === WebSocket.OPEN) {
          const basePrice = client.baselinePrices.get(ticker) || price;
          const change = price - basePrice;
          const changePercent = (change / basePrice) * 100;

          const update = {
            ticker,
            price,
            change,
            changePercent,
            timestamp,
          };

          client.socket.send(JSON.stringify(update));
        }
      });
    } catch (error) {
      console.error('[Binance] Error processing message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error(`[Binance] Error on ${symbol}:`, error);
  };

  ws.onclose = () => {
    console.log(`[Binance] Disconnected from ${symbol}`);
    binanceConnections.delete(symbol);
    
    // Reconnect if there are still subscribed clients
    const hasSubscribers = Array.from(clients).some(client => 
      Array.from(client.tickers).some(t => toBinanceSymbol(t) === symbol)
    );
    
    if (hasSubscribers) {
      console.log(`[Binance] Reconnecting to ${symbol} in 3s...`);
      setTimeout(() => connectToBinance(symbol), 3000);
    }
  };

  binanceConnections.set(symbol, ws);
}

serve((req) => {
  const upgrade = req.headers.get("upgrade") || "";
  
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: corsHeaders 
    });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  const client: ClientSubscription = {
    socket,
    tickers: new Set(),
    baselinePrices: new Map(),
  };

  socket.onopen = () => {
    console.log('[Client] WebSocket connected');
    clients.add(client);
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.type === 'subscribe') {
        const tickers = message.tickers || [];
        const basePrices = message.basePrices || {};
        
        console.log(`[Client] Subscribe request:`, tickers);
        
        tickers.forEach((ticker: string) => {
          client.tickers.add(ticker);
          
          if (basePrices[ticker]) {
            client.baselinePrices.set(ticker, basePrices[ticker]);
          }
          
          // Connect to Binance for this symbol
          const symbol = toBinanceSymbol(ticker);
          connectToBinance(symbol);
        });
        
        socket.send(JSON.stringify({ 
          type: 'subscribed', 
          tickers: Array.from(client.tickers) 
        }));
      }
      
      if (message.type === 'unsubscribe') {
        const tickers = message.tickers || [];
        
        tickers.forEach((ticker: string) => {
          client.tickers.delete(ticker);
          client.baselinePrices.delete(ticker);
        });
        
        console.log(`[Client] Unsubscribed from:`, tickers);
      }
    } catch (error) {
      console.error('[Client] Error processing message:', error);
    }
  };

  socket.onclose = () => {
    console.log('[Client] WebSocket disconnected');
    clients.delete(client);
    
    // Close Binance connections if no more subscribers
    client.tickers.forEach(ticker => {
      const symbol = toBinanceSymbol(ticker);
      const hasOtherSubscribers = Array.from(clients).some(c => 
        c !== client && c.tickers.has(ticker)
      );
      
      if (!hasOtherSubscribers && binanceConnections.has(symbol)) {
        console.log(`[Binance] Closing connection to ${symbol} (no subscribers)`);
        binanceConnections.get(symbol)?.close();
        binanceConnections.delete(symbol);
      }
    });
  };

  socket.onerror = (error) => {
    console.error('[Client] WebSocket error:', error);
  };

  return response;
});
