import { useEffect, useState } from "react";
import { priceStreamService, PriceUpdate } from "@/lib/websocket/priceStream";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface AnimatedPriceProps {
  ticker: string;
  basePrice: number;
  showChange?: boolean;
  className?: string;
}

export function AnimatedPrice({
  ticker,
  basePrice,
  showChange = true,
  className,
}: AnimatedPriceProps) {
  const [priceData, setPriceData] = useState<PriceUpdate | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    const unsubscribe = priceStreamService.subscribe(
      ticker,
      (update: PriceUpdate) => {
        setPriceData((prev) => {
          if (prev) {
            const newFlash = update.price > prev.price ? "up" : update.price < prev.price ? "down" : null;
            if (newFlash) {
              setFlash(newFlash);
              setTimeout(() => setFlash(null), 500);
            }
          }
          return update;
        });
      },
      basePrice
    );

    return () => unsubscribe();
  }, [ticker, basePrice]);

  if (!priceData) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="font-mono">${basePrice.toFixed(2)}</span>
      </div>
    );
  }

  const isPositive = priceData.changePercent >= 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "font-mono transition-all duration-300",
          flash === "up" && "text-success scale-110",
          flash === "down" && "text-destructive scale-110",
          !flash && "text-foreground"
        )}
      >
        ${priceData.price.toFixed(2)}
      </span>
      {showChange && (
        <span
          className={cn(
            "flex items-center gap-1 text-sm font-medium transition-colors duration-300",
            isPositive ? "text-success" : "text-destructive"
          )}
        >
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {isPositive ? "+" : ""}
          {priceData.changePercent.toFixed(2)}%
        </span>
      )}
    </div>
  );
}
