import { useState } from "react";
import { LayoutShell } from "@/components/LayoutShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, PlayCircle } from "lucide-react";
import { BacktestConfig, BacktestResult, AssetType } from "@/lib/types";
import { runBacktest } from "@/lib/backtest/engine";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

const Backtest = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const [config, setConfig] = useState<BacktestConfig>({
    tickers: ["AAPL", "MSFT", "GOOGL"],
    assetType: "stocks" as AssetType,
    strategies: ["ma_crossover", "rsi_mean_reversion", "multi_factor", "ml_strategy"],
    startDate: "2023-01-01",
    endDate: "2024-01-01",
    rebalancePeriod: 30,
    initialCapital: 100000,
  });

  const handleRunBacktest = async () => {
    setLoading(true);
    try {
      const backtestResult = await runBacktest(config);
      setResult(backtestResult);
      toast.success("Backtest completed successfully");
    } catch (error) {
      console.error("Backtest error:", error);
      toast.error("Failed to run backtest");
    } finally {
      setLoading(false);
    }
  };

  const strategies = [
    { id: "ma_crossover", name: "Moving Average Crossover" },
    { id: "rsi_mean_reversion", name: "RSI Mean Reversion" },
    { id: "multi_factor", name: "Multi-Factor" },
    { id: "ml_strategy", name: "ML Strategy" },
  ];

  const toggleStrategy = (strategyId: string) => {
    setConfig((prev) => ({
      ...prev,
      strategies: prev.strategies.includes(strategyId)
        ? prev.strategies.filter((s) => s !== strategyId)
        : [...prev.strategies, strategyId],
    }));
  };

  return (
    <LayoutShell>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold text-foreground">Backtest Engine</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Test strategies on historical data to evaluate performance
          </p>
        </div>

        {/* Configuration */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="tickers">Tickers (comma-separated)</Label>
                <Input
                  id="tickers"
                  value={config.tickers.join(",")}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      tickers: e.target.value.split(",").map((t) => t.trim()),
                    }))
                  }
                  placeholder="AAPL, MSFT, GOOGL"
                />
              </div>

              <div>
                <Label htmlFor="assetType">Asset Type</Label>
                <select
                  id="assetType"
                  value={config.assetType}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, assetType: e.target.value as AssetType }))
                  }
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground"
                >
                  <option value="stocks">Stocks</option>
                  <option value="crypto">Crypto</option>
                  <option value="forex">Forex</option>
                </select>
              </div>

              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={config.startDate}
                  onChange={(e) => setConfig((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={config.endDate}
                  onChange={(e) => setConfig((prev) => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="rebalancePeriod">Rebalance Period (days)</Label>
                <Input
                  id="rebalancePeriod"
                  type="number"
                  value={config.rebalancePeriod}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, rebalancePeriod: parseInt(e.target.value) }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="initialCapital">Initial Capital ($)</Label>
                <Input
                  id="initialCapital"
                  type="number"
                  value={config.initialCapital}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, initialCapital: parseFloat(e.target.value) }))
                  }
                />
              </div>

              <div>
                <Label className="mb-2 block">Strategies</Label>
                <div className="space-y-2">
                  {strategies.map((strategy) => (
                    <div key={strategy.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={strategy.id}
                        checked={config.strategies.includes(strategy.id)}
                        onCheckedChange={() => toggleStrategy(strategy.id)}
                      />
                      <label
                        htmlFor={strategy.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {strategy.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleRunBacktest}
            disabled={loading || config.strategies.length === 0}
            className="mt-6 bg-primary hover:bg-primary/90"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <PlayCircle className="h-4 w-4 mr-2" />
            )}
            Run Backtest
          </Button>
        </Card>

        {/* Results */}
        {result && (
          <>
            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="p-4 bg-card/50">
                <div className="text-xs text-muted-foreground mb-1">Total Return</div>
                <div className="text-2xl font-bold text-success">
                  {(result.metrics.totalReturn * 100).toFixed(2)}%
                </div>
              </Card>
              <Card className="p-4 bg-card/50">
                <div className="text-xs text-muted-foreground mb-1">CAGR</div>
                <div className="text-2xl font-bold text-primary">
                  {(result.metrics.cagr * 100).toFixed(2)}%
                </div>
              </Card>
              <Card className="p-4 bg-card/50">
                <div className="text-xs text-muted-foreground mb-1">Sharpe Ratio</div>
                <div className="text-2xl font-bold text-foreground">
                  {result.metrics.sharpeRatio.toFixed(2)}
                </div>
              </Card>
              <Card className="p-4 bg-card/50">
                <div className="text-xs text-muted-foreground mb-1">Max Drawdown</div>
                <div className="text-2xl font-bold text-destructive">
                  {(result.metrics.maxDrawdown * 100).toFixed(2)}%
                </div>
              </Card>
              <Card className="p-4 bg-card/50">
                <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
                <div className="text-2xl font-bold text-warning">
                  {(result.metrics.winRate * 100).toFixed(1)}%
                </div>
              </Card>
            </div>

            {/* Equity Curve */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Equity Curve</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={result.equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        year: "2-digit",
                      })
                    }
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, "Portfolio Value"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Trades */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-foreground">
                Recent Trades ({result.trades.length} total)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Date</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Ticker</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Action</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Price</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Qty</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.slice(0, 20).map((trade, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 text-foreground">{trade.date}</td>
                        <td className="py-2 font-mono font-semibold text-foreground">{trade.ticker}</td>
                        <td className="py-2">
                          <span
                            className={
                              trade.action === "buy" ? "text-success" : "text-destructive"
                            }
                          >
                            {trade.action.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono text-foreground">
                          ${trade.price.toFixed(2)}
                        </td>
                        <td className="py-2 text-right text-foreground">{trade.quantity}</td>
                        <td className="py-2 text-right font-mono text-foreground">
                          ${trade.value.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </LayoutShell>
  );
};

export default Backtest;
