import { useEffect, useState } from "react";
import { priceStreamService, PriceUpdate } from "@/lib/websocket/priceStream";
import { cn } from "@/lib/utils";

interface TickerItem {
  ticker: string;
  price: number;
  changePercent: number;
  previousPrice?: number;
}

interface LiveTickerTapeProps {
  tickers: string[];
  basePrices: Map<string, number>;
}

export function LiveTickerTape({ tickers, basePrices }: LiveTickerTapeProps) {
  const [tickerData, setTickerData] = useState<Map<string, TickerItem>>(new Map());

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    tickers.forEach((ticker) => {
      const basePrice = basePrices.get(ticker);
      const unsubscribe = priceStreamService.subscribe(
        ticker,
        (update: PriceUpdate) => {
          setTickerData((prev) => {
            const newMap = new Map(prev);
            const current = newMap.get(ticker);
            newMap.set(ticker, {
              ticker: update.ticker,
              price: update.price,
              changePercent: update.changePercent,
              previousPrice: current?.price,
            });
            return newMap;
          });
        },
        basePrice
      );
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [tickers, basePrices]);

  const items = Array.from(tickerData.values());

  if (items.length === 0) return null;

  return (
    <div className="w-full bg-card/30 border-y border-border overflow-hidden">
      <div className="flex animate-[scroll_30s_linear_infinite] hover:pause">
        {/* Duplicate items for seamless loop */}
        {[...items, ...items, ...items].map((item, idx) => {
          const isUp = item.changePercent >= 0;
          const isPriceUp = item.previousPrice && item.price > item.previousPrice;
          const isPriceDown = item.previousPrice && item.price < item.previousPrice;

          return (
            <div
              key={`${item.ticker}-${idx}`}
              className={cn(
                "flex items-center gap-2 px-6 py-2 border-r border-border/50 whitespace-nowrap transition-colors duration-300",
                isPriceUp && "bg-success/10",
                isPriceDown && "bg-destructive/10"
              )}
            >
              <span className="font-semibold text-foreground">{item.ticker}</span>
              <span
                className={cn(
                  "font-mono text-sm transition-all duration-300",
                  isPriceUp && "text-success scale-110",
                  isPriceDown && "text-destructive scale-110",
                  !isPriceUp && !isPriceDown && "text-foreground"
                )}
              >
                ${item.price.toFixed(2)}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  isUp ? "text-success" : "text-destructive"
                )}
              >
                {isUp ? "+" : ""}
                {item.changePercent.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
