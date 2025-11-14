import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { LayoutShell } from "@/components/LayoutShell";
import { getAssetDetails, AssetDetails } from "@/lib/api/asset";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

const AssetDetail = () => {
  const { ticker } = useParams<{ ticker: string }>();
  const [assetData, setAssetData] = useState<AssetDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticker) return;

    setLoading(true);
    getAssetDetails(ticker)
      .then(setAssetData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <LayoutShell>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </LayoutShell>
    );
  }

  if (!assetData) {
    return (
      <LayoutShell>
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Asset not found</p>
          <Link to="/">
            <Button className="mt-4">Back to Dashboard</Button>
          </Link>
        </Card>
      </LayoutShell>
    );
  }

  const chartData = assetData.historicalData.map((d) => ({
    date: d.date,
    price: d.close,
  }));

  const getSignalColor = (direction: string) => {
    switch (direction) {
      case "buy":
        return "text-success border-success/50";
      case "sell":
        return "text-destructive border-destructive/50";
      default:
        return "text-muted-foreground border-muted";
    }
  };

  return (
    <LayoutShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold font-mono text-foreground">{assetData.ticker}</h2>
              <Badge variant="outline" className="capitalize">
                {assetData.assetType}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Detailed Analysis & Signals</p>
          </div>
        </div>

        {/* Price Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6 bg-card/50">
            <div className="text-xs text-muted-foreground mb-2">Current Price</div>
            <div className="text-3xl font-bold font-mono text-foreground">
              ${assetData.currentPrice.toFixed(2)}
            </div>
            <div
              className={cn(
                "text-sm font-medium flex items-center gap-1 mt-2",
                assetData.priceChangePct >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {assetData.priceChangePct >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {assetData.priceChangePct >= 0 ? "+" : ""}
              {assetData.priceChangePct.toFixed(2)}% (24h)
            </div>
          </Card>

          <Card className="p-6 bg-card/50">
            <div className="text-xs text-muted-foreground mb-2">Volatility (Annual)</div>
            <div className="text-3xl font-bold font-mono text-warning">
              {assetData.statistics.volatility.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              Risk measure based on 60-day data
            </div>
          </Card>

          <Card className="p-6 bg-card/50">
            <div className="text-xs text-muted-foreground mb-2">Avg Daily Return</div>
            <div
              className={cn(
                "text-3xl font-bold font-mono",
                assetData.statistics.avgDailyReturn >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {assetData.statistics.avgDailyReturn >= 0 ? "+" : ""}
              {assetData.statistics.avgDailyReturn.toFixed(3)}%
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              Range: {assetData.statistics.minDailyReturn.toFixed(2)}% to{" "}
              {assetData.statistics.maxDailyReturn.toFixed(2)}%
            </div>
          </Card>
        </div>

        {/* Price Chart */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Price History (180 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value.toFixed(0)}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Strategy Signals */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Strategy Signals</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assetData.signals.map((signal, i) => (
              <Card key={i} className="p-4 bg-secondary/50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-foreground">{signal.name}</h4>
                  <Badge variant="outline" className={cn("font-semibold", getSignalColor(signal.direction))}>
                    {signal.direction.toUpperCase()}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Normalized Score</span>
                    <span className="font-mono font-semibold text-foreground">
                      {signal.normalizedScore.toFixed(2)}
                    </span>
                  </div>
                  {signal.meta && Object.entries(signal.meta).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                      <span className="text-sm font-medium text-foreground">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </Card>
      </div>
    </LayoutShell>
  );
};

export default AssetDetail;
