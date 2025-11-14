// Real-time price streaming service via WebSocket
// Connects to Binance WebSocket API through edge function proxy

export interface PriceUpdate {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

type PriceUpdateCallback = (update: PriceUpdate) => void;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const WS_URL = SUPABASE_URL.replace('https://', 'wss://');

class PriceStreamService {
  private subscribers: Map<string, Set<PriceUpdateCallback>> = new Map();
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private baselinePrices: Map<string, number> = new Map();
  private isConnecting: boolean = false;

  subscribe(ticker: string, callback: PriceUpdateCallback, basePrice?: number) {
    if (!this.subscribers.has(ticker)) {
      this.subscribers.set(ticker, new Set());
    }
    this.subscribers.get(ticker)!.add(callback);

    // Store baseline price if provided
    if (basePrice !== undefined) {
      this.baselinePrices.set(ticker, basePrice);
    }

    // Connect WebSocket if not already connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connectWebSocket();
    } else {
      // If already connected, send subscribe message
      this.sendSubscribe([ticker]);
    }

    // Return unsubscribe function
    return () => this.unsubscribe(ticker, callback);
  }

  unsubscribe(ticker: string, callback: PriceUpdateCallback) {
    const subs = this.subscribers.get(ticker);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) {
        this.subscribers.delete(ticker);
        
        // Send unsubscribe message if WebSocket is open
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ 
            type: 'unsubscribe', 
            tickers: [ticker] 
          }));
        }
      }
    }
  }

  private connectWebSocket() {
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    console.log('[PriceStream] Connecting to WebSocket...');

    try {
      this.ws = new WebSocket(`${WS_URL}/functions/v1/price-stream`);

      this.ws.onopen = () => {
        console.log('[PriceStream] WebSocket connected');
        this.isConnecting = false;

        // Subscribe to all active tickers
        const tickers = Array.from(this.subscribers.keys());
        if (tickers.length > 0) {
          this.sendSubscribe(tickers);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'subscribed') {
            console.log('[PriceStream] Subscribed to:', data.tickers);
            return;
          }

          // Handle price update
          const update: PriceUpdate = data;
          const subs = this.subscribers.get(update.ticker);
          if (subs) {
            subs.forEach(callback => callback(update));
          }
        } catch (error) {
          console.error('[PriceStream] Error processing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[PriceStream] WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('[PriceStream] WebSocket disconnected');
        this.isConnecting = false;
        this.ws = null;

        // Attempt reconnection if there are active subscribers
        if (this.subscribers.size > 0) {
          console.log('[PriceStream] Reconnecting in 3 seconds...');
          this.reconnectTimer = setTimeout(() => {
            this.connectWebSocket();
          }, 3000);
        }
      };
    } catch (error) {
      console.error('[PriceStream] Error creating WebSocket:', error);
      this.isConnecting = false;
    }
  }

  private sendSubscribe(tickers: string[]) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const basePrices: Record<string, number> = {};
      tickers.forEach(ticker => {
        const price = this.baselinePrices.get(ticker);
        if (price) {
          basePrices[ticker] = price;
        }
      });

      this.ws.send(JSON.stringify({
        type: 'subscribe',
        tickers,
        basePrices,
      }));
    }
  }

  cleanup() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.subscribers.clear();
    this.baselinePrices.clear();
  }
}

export const priceStreamService = new PriceStreamService();
