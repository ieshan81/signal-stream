import { useState, useEffect } from 'react';
import { LayoutShell } from '@/components/LayoutShell';
import { usePortfolio, usePositionManager } from '@/hooks/usePortfolio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AssetType } from '@/lib/types';
import { getAssetType } from '@/lib/utils/tickerMapping';

export default function Portfolio() {
  const { positions, loading, refetch } = usePortfolio();
  const { addPosition, deletePosition } = usePositionManager();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPosition, setNewPosition] = useState({
    ticker: '',
    quantity: '',
    cost_basis: ''
  });

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const asset_type = getAssetType(newPosition.ticker.toUpperCase());
    const { error } = await addPosition(
      newPosition.ticker.toUpperCase(),
      asset_type,
      parseFloat(newPosition.quantity),
      parseFloat(newPosition.cost_basis)
    );

    if (!error) {
      setShowAddDialog(false);
      setNewPosition({ ticker: '', quantity: '', cost_basis: '' });
      refetch();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await deletePosition(id);
    if (!error) {
      refetch();
    }
  };

  const totalCost = positions.reduce((sum, p) => sum + (p.quantity * p.cost_basis), 0);

  return (
    <LayoutShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">Portfolio</h2>
            <p className="text-muted-foreground">Track your investments</p>
          </div>

          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Position
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Position</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddPosition} className="space-y-4">
                <div>
                  <Label htmlFor="ticker">Ticker</Label>
                  <Input
                    id="ticker"
                    placeholder="AAPL, BTC-USD, EURUSD=X"
                    value={newPosition.ticker}
                    onChange={(e) => setNewPosition(prev => ({ ...prev, ticker: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.00000001"
                    placeholder="10"
                    value={newPosition.quantity}
                    onChange={(e) => setNewPosition(prev => ({ ...prev, quantity: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cost_basis">Average Cost per Share</Label>
                  <Input
                    id="cost_basis"
                    type="number"
                    step="0.01"
                    placeholder="150.00"
                    value={newPosition.cost_basis}
                    onChange={(e) => setNewPosition(prev => ({ ...prev, cost_basis: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">Add Position</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : positions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No positions yet. Add your first position to get started!</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Position
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Total Portfolio Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">${totalCost.toFixed(2)}</div>
                <p className="text-sm text-muted-foreground mt-1">Cost Basis</p>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {positions.map((position) => (
                <Card key={position.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-bold">{position.ticker}</h3>
                          <Badge variant="outline">{position.asset_type}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Quantity</p>
                            <p className="font-medium">{position.quantity}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Avg Cost</p>
                            <p className="font-medium">${position.cost_basis.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total Cost</p>
                            <p className="font-medium">${(position.quantity * position.cost_basis).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(position.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </LayoutShell>
  );
}
