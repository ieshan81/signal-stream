import { useState, useEffect } from "react";
import { AssetRecommendation, AssetType, RecommendationType } from "@/lib/types";
import { getRecommendations } from "@/lib/api/recommendations";
import { LayoutShell } from "@/components/LayoutShell";
import { RecommendationsTable } from "@/components/RecommendationsTable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const Index = () => {
  const [recommendations, setRecommendations] = useState<AssetRecommendation[]>([]);
  const [filteredRecommendations, setFilteredRecommendations] = useState<AssetRecommendation[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [assetType, setAssetType] = useState<AssetType | "all">("all");
  const [recFilter, setRecFilter] = useState<RecommendationType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const data = await getRecommendations(assetType);
      setRecommendations(data.recommendations || []);
      setLastUpdate(data.lastUpdate);
      toast.success("Recommendations updated");
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      toast.error("Failed to fetch recommendations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [assetType]);

  useEffect(() => {
    let filtered = [...recommendations];

    // Filter by recommendation type
    if (recFilter !== "all") {
      filtered = filtered.filter((r) => r.recommendation === recFilter);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((r) =>
        r.ticker.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredRecommendations(filtered);
  }, [recommendations, recFilter, searchQuery]);

  const assetTypes: (AssetType | "all")[] = ["all", "stocks", "crypto", "forex"];
  const recTypes: (RecommendationType | "all")[] = ["all", "BUY", "SELL", "HOLD"];

  const getStatistics = () => {
    const buyCount = recommendations.filter((r) => r.recommendation === "BUY").length;
    const sellCount = recommendations.filter((r) => r.recommendation === "SELL").length;
    const holdCount = recommendations.filter((r) => r.recommendation === "HOLD").length;
    const avgConfidence =
      recommendations.length > 0
        ? recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length
        : 0;

    return { buyCount, sellCount, holdCount, avgConfidence };
  };

  const stats = getStatistics();

  return (
    <LayoutShell>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Market Recommendations</h2>
            <p className="text-sm text-muted-foreground mt-1">
              AI-powered multi-strategy trading signals
              {lastUpdate && (
                <span className="ml-2">
                  • Last updated: {new Date(lastUpdate).toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>

          <Button
            onClick={fetchRecommendations}
            disabled={loading}
            className="bg-primary hover:bg-primary/90"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-card/50 border-success/30">
            <div className="text-xs text-muted-foreground mb-1">Buy Signals</div>
            <div className="text-2xl font-bold text-success">{stats.buyCount}</div>
          </Card>
          <Card className="p-4 bg-card/50 border-destructive/30">
            <div className="text-xs text-muted-foreground mb-1">Sell Signals</div>
            <div className="text-2xl font-bold text-destructive">{stats.sellCount}</div>
          </Card>
          <Card className="p-4 bg-card/50 border-border">
            <div className="text-xs text-muted-foreground mb-1">Hold Signals</div>
            <div className="text-2xl font-bold text-foreground">{stats.holdCount}</div>
          </Card>
          <Card className="p-4 bg-card/50 border-primary/30">
            <div className="text-xs text-muted-foreground mb-1">Avg Confidence</div>
            <div className="text-2xl font-bold text-primary">{stats.avgConfidence.toFixed(0)}%</div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ticker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Asset Type Filter */}
            <div className="flex gap-2">
              {assetTypes.map((type) => (
                <Button
                  key={type}
                  variant={assetType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAssetType(type)}
                  className={cn(assetType === type && "bg-primary hover:bg-primary/90")}
                >
                  {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
            </div>

            {/* Recommendation Filter */}
            <div className="flex gap-2">
              {recTypes.map((type) => (
                <Button
                  key={type}
                  variant={recFilter === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRecFilter(type)}
                  className={cn(recFilter === type && "bg-primary hover:bg-primary/90")}
                >
                  {type === "all" ? "All" : type}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Recommendations Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredRecommendations.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No recommendations found</p>
          </Card>
        ) : (
          <RecommendationsTable recommendations={filteredRecommendations} />
        )}
      </div>
    </LayoutShell>
  );
};

export default Index;
