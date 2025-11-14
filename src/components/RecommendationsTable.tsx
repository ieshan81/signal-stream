import { AssetRecommendation } from "@/lib/types";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { ArrowUp, ArrowDown, Minus, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { AnimatedPrice } from "@/components/AnimatedPrice";

interface Props {
  recommendations: AssetRecommendation[];
}

export function RecommendationsTable({ recommendations }: Props) {
  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case "BUY":
        return "bg-success/20 text-success border-success/30";
      case "SELL":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getRecommendationIcon = (rec: string) => {
    switch (rec) {
      case "BUY":
        return <ArrowUp className="h-3 w-3" />;
      case "SELL":
        return <ArrowDown className="h-3 w-3" />;
      default:
        return <Minus className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-3">
      {recommendations.map((rec) => (
        <Card
          key={rec.ticker}
          className="p-4 hover:border-primary/50 transition-all cursor-pointer group"
        >
          <Link to={`/asset/${rec.ticker}`} className="block">
            <div className="flex items-center justify-between gap-4">
              {/* Ticker & Asset Type */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-foreground">
                      {rec.ticker}
                    </span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">
                    {rec.assetType}
                  </span>
                </div>
              </div>

              {/* Price Info */}
              <div className="flex flex-col items-end">
                <AnimatedPrice 
                  ticker={rec.ticker} 
                  basePrice={rec.currentPrice}
                  showChange={true}
                />
              </div>

              {/* Recommendation */}
              <div className="flex flex-col items-center gap-2">
                <Badge
                  className={cn(
                    "font-semibold px-3 py-1 flex items-center gap-1.5",
                    getRecommendationColor(rec.recommendation)
                  )}
                >
                  {getRecommendationIcon(rec.recommendation)}
                  {rec.recommendation}
                </Badge>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs text-muted-foreground">Score</span>
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {rec.score.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Confidence */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">Confidence</span>
                <div className="flex flex-col items-center">
                  <span className="font-mono text-base font-bold text-primary">
                    {rec.confidence.toFixed(0)}%
                  </span>
                  <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${rec.confidence}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Volatility */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">Volatility</span>
                <span className="font-mono text-sm font-semibold text-warning">
                  {(rec.volatility * 100).toFixed(1)}%
                </span>
              </div>

              {/* Signals Summary */}
              <div className="flex flex-col gap-1 min-w-[120px]">
                <span className="text-xs text-muted-foreground mb-1">Signals</span>
                <div className="flex flex-wrap gap-1">
                  {Object.values(rec.contributingSignals).map((signal, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        signal.direction === "buy" && "border-success/50 text-success",
                        signal.direction === "sell" && "border-destructive/50 text-destructive",
                        signal.direction === "neutral" && "border-muted text-muted-foreground"
                      )}
                    >
                      {signal.name.split(" ")[0]}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        </Card>
      ))}
    </div>
  );
}
