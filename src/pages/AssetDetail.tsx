import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { LayoutShell } from "@/components/LayoutShell";
import { getAssetDetails, AssetDetails } from "@/lib/api/asset";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, TrendingUp, TrendingDown, Star, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useWatchlist, useWatchlistManager } from "@/hooks/useWatchlist";
import { usePositionManager } from "@/hooks/usePortfolio";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AssetDetail = () => {
  const { ticker } = useParams<{ ticker: string }>();
  const [assetData, setAssetData] = useState<AssetDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { watchlist, refetch: refetchWatchlist } = useWatchlist();
  const { addToWatchlist, removeFromWatchlist } = useWatchlistManager();
  const { addPosition } = usePositionManager();
  
  const [addPositionOpen, setAddPositionOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [costBasis, setCostBasis] = useState("");

  const isInWatchlist = watchlist.some(item => item.ticker === ticker);

  useEffect(() => {
    if (!ticker) return;

    setLoading(true);
    setError(null);
    getAssetDetails(ticker)
      .then(setAssetData)
      .catch((err) => {
        console.error(err);
        setError(err.message || "Failed to load asset data");
      })
      .finally(() => setLoading(false));
  }, [ticker]);

  const handleWatchlistToggle = async () => {
    if (!user) {
      toast.error("Please sign in to use watchlist");
      return;
    }

    if (!assetData) return;

    if (isInWatchlist) {
      const item = watchlist.find(w => w.ticker === ticker);
      if (item) {
        const { error } = await removeFromWatchlist(item.id);
        if (!error) refetchWatchlist();
      }
    } else {
      const { error } = await addToWatchlist(ticker!, assetData.assetType);
      if (!error) refetchWatchlist();
    }
  };

  const handleAddPosition = async () => {
    if (!user) {
      toast.error("Please sign in to manage portfolio");
      return;
    }

    if (!assetData || !quantity || !costBasis) {
      toast.error("Please fill in all fields");
      return;
    }

    const { error } = await addPosition(
      ticker!,
      assetData.assetType,
      parseFloat(quantity),
      parseFloat(costBasis)
    );

    if (!error) {
      setAddPositionOpen(false);
      setQuantity("");
      setCostBasis("");
    }
  };

  if (loading) {
    return (
      <LayoutShell>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </LayoutShell>
    );
  }

  if (error || !assetData) {
    return (
      <LayoutShell>
        <Card className="p-12 text-center max-w-2xl mx-auto">
          <div className="text-destructive mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-xl font-semibold mb-2">Unable to Load Ticker</h3>
          </div>
          <p className="text-foreground font-medium mb-2">
            {ticker ? `"${ticker}"` : "No ticker specified"}
          </p>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            {error || `This ticker symbol was not found. Please verify you're using the correct format:`}
          </p>
          <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left text-sm max-w-md mx-auto">
            <p className="font-semibold mb-2">Ticker Format Examples:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Stocks: AAPL, MSFT, GOOGL, TSLA</li>
              <li>• Crypto: BTC-USD, ETH-USD, SOL-USD</li>
              <li>• Forex: EURUSD=X, GBPUSD=X, USDJPY=X</li>
            </ul>
          </div>
          <Link to="/">
            <Button>Back to Dashboard</Button>
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
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant={isInWatchlist ? "secondary" : "outline"}
              size="sm"
              onClick={handleWatchlistToggle}
              disabled={!user}
            >
              <Star className={cn("h-4 w-4", isInWatchlist && "fill-current")} />
              <span className="ml-2">{isInWatchlist ? "In Watchlist" : "Add to Watchlist"}</span>
            </Button>
            
            <Dialog open={addPositionOpen} onOpenChange={setAddPositionOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!user}>
                  <Plus className="h-4 w-4" />
                  <span className="ml-2">Add to Portfolio</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add {assetData.ticker} to Portfolio</DialogTitle>
                  <DialogDescription>
                    Enter the quantity and cost basis for this position
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="any"
                      placeholder="10"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost-basis">Cost Basis (per unit)</Label>
                    <Input
                      id="cost-basis"
                      type="number"
                      step="0.01"
                      placeholder="100.00"
                      value={costBasis}
                      onChange={(e) => setCostBasis(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleAddPosition} className="w-full">
                    Add Position
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
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
