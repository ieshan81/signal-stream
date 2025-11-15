import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { AssetType } from '@/lib/types';

export interface PortfolioPosition {
  id: string;
  ticker: string;
  asset_type: AssetType;
  quantity: number;
  cost_basis: number;
  created_at: string;
  updated_at: string;
}

export interface PortfolioMetrics {
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  positions: (PortfolioPosition & {
    currentPrice: number;
    currentValue: number;
    pnl: number;
    pnlPercent: number;
  })[];
}

export function usePortfolio() {
  const { user } = useAuth();
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPositions = async () => {
    if (!user) {
      setPositions([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('portfolio_positions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPositions((data || []) as PortfolioPosition[]);
    } catch (error: any) {
      console.error('Error fetching positions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load portfolio positions',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, [user]);

  return { positions, loading, refetch: fetchPositions };
}

export function usePositionManager() {
  const { user } = useAuth();

  const addPosition = async (ticker: string, asset_type: AssetType, quantity: number, cost_basis: number) => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to add positions',
        variant: 'destructive'
      });
      return { error: new Error('Not authenticated') };
    }

    try {
      const { error } = await supabase
        .from('portfolio_positions')
        .insert({
          user_id: user.id,
          ticker,
          asset_type,
          quantity,
          cost_basis
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Added ${ticker} to your portfolio`
      });

      return { error: null };
    } catch (error: any) {
      console.error('Error adding position:', error);
      
      let errorMessage = 'Failed to add position';
      if (error.code === '23505') {
        errorMessage = 'You already have this ticker in your portfolio';
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });

      return { error };
    }
  };

  const updatePosition = async (id: string, quantity: number, cost_basis: number) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { error } = await supabase
        .from('portfolio_positions')
        .update({ quantity, cost_basis })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Position updated'
      });

      return { error: null };
    } catch (error: any) {
      console.error('Error updating position:', error);
      toast({
        title: 'Error',
        description: 'Failed to update position',
        variant: 'destructive'
      });

      return { error };
    }
  };

  const deletePosition = async (id: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { error } = await supabase
        .from('portfolio_positions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Position removed'
      });

      return { error: null };
    } catch (error: any) {
      console.error('Error deleting position:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove position',
        variant: 'destructive'
      });

      return { error };
    }
  };

  return { addPosition, updatePosition, deletePosition };
}
