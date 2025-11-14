// Simulated real-time price streaming service
// In production, replace with actual WebSocket connection to market data provider

export interface PriceUpdate {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

type PriceUpdateCallback = (update: PriceUpdate) => void;

class PriceStreamService {
  private subscribers: Map<string, Set<PriceUpdateCallback>> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private lastPrices: Map<string, number> = new Map();
  private baselinePrices: Map<string, number> = new Map();

  subscribe(ticker: string, callback: PriceUpdateCallback, basePrice?: number) {
    if (!this.subscribers.has(ticker)) {
      this.subscribers.set(ticker, new Set());
    }
    this.subscribers.get(ticker)!.add(callback);

    // Store baseline price if provided
    if (basePrice !== undefined && !this.baselinePrices.has(ticker)) {
      this.baselinePrices.set(ticker, basePrice);
      this.lastPrices.set(ticker, basePrice);
    }

    // Start streaming if this is the first subscriber
    if (this.subscribers.get(ticker)!.size === 1) {
      this.startStreaming(ticker);
    }

    // Return unsubscribe function
    return () => this.unsubscribe(ticker, callback);
  }

  unsubscribe(ticker: string, callback: PriceUpdateCallback) {
    const subs = this.subscribers.get(ticker);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) {
        this.stopStreaming(ticker);
        this.subscribers.delete(ticker);
      }
    }
  }

  private startStreaming(ticker: string) {
    // Simulate price updates every second
    const interval = setInterval(() => {
      const lastPrice = this.lastPrices.get(ticker) || this.baselinePrices.get(ticker) || 100;
      const basePrice = this.baselinePrices.get(ticker) || lastPrice;
      
      // Generate realistic price movement (±0.5% typical, occasionally larger)
      const volatility = Math.random() > 0.95 ? 0.02 : 0.005;
      const change = (Math.random() - 0.5) * 2 * volatility;
      const newPrice = lastPrice * (1 + change);
      
      const priceChange = newPrice - basePrice;
      const changePercent = (priceChange / basePrice) * 100;

      this.lastPrices.set(ticker, newPrice);

      const update: PriceUpdate = {
        ticker,
        price: newPrice,
        change: priceChange,
        changePercent,
        timestamp: Date.now(),
      };

      // Notify all subscribers
      const subs = this.subscribers.get(ticker);
      if (subs) {
        subs.forEach(callback => callback(update));
      }
    }, 1000);

    this.intervals.set(ticker, interval);
  }

  private stopStreaming(ticker: string) {
    const interval = this.intervals.get(ticker);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(ticker);
    }
    this.lastPrices.delete(ticker);
    this.baselinePrices.delete(ticker);
  }

  cleanup() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
    this.subscribers.clear();
    this.lastPrices.clear();
    this.baselinePrices.clear();
  }
}

export const priceStreamService = new PriceStreamService();
