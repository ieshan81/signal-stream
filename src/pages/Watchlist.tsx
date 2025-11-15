import { useState } from 'react';
import { LayoutShell } from '@/components/LayoutShell';
import { useWatchlist, useWatchlistManager } from '@/hooks/useWatchlist';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, X, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getAssetType } from '@/lib/utils/tickerMapping';
import { useNavigate } from 'react-router-dom';

export default function Watchlist() {
  const { watchlist, loading, refetch } = useWatchlist();
  const { addToWatchlist, removeFromWatchlist } = useWatchlistManager();
  const navigate = useNavigate();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTicker, setNewTicker] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const ticker = newTicker.toUpperCase();
    const asset_type = getAssetType(ticker);
    
    const { error } = await addToWatchlist(ticker, asset_type);

    if (!error) {
      setShowAddDialog(false);
      setNewTicker('');
      refetch();
    }
  };

  const handleRemove = async (id: string) => {
    const { error } = await removeFromWatchlist(id);
    if (!error) {
      refetch();
    }
  };

  return (
    <LayoutShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">Watchlist</h2>
            <p className="text-muted-foreground">Track assets you're interested in</p>
          </div>

          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add to Watchlist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add to Watchlist</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <Label htmlFor="ticker">Ticker Symbol</Label>
                  <Input
                    id="ticker"
                    placeholder="AAPL, BTC-USD, EURUSD=X"
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Examples: AAPL (stock), BTC-USD (crypto), EURUSD=X (forex)
                  </p>
                </div>
                <Button type="submit" className="w-full">Add to Watchlist</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : watchlist.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No assets in your watchlist. Start tracking assets you're interested in!
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Asset
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {watchlist.map((item) => (
              <Card
                key={item.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/asset/${item.ticker}`)}
              >
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold">{item.ticker}</h3>
                      <Badge variant="outline" className="mt-1">
                        {item.asset_type}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(item.id);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Added {new Date(item.added_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
