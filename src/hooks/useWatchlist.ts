import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { AssetType } from '@/lib/types';

export interface WatchlistItem {
  id: string;
  ticker: string;
  asset_type: AssetType;
  added_at: string;
}

export function useWatchlist() {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWatchlist = async () => {
    if (!user) {
      setWatchlist([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('watchlist')
        .select('*')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false });

      if (error) throw error;
      setWatchlist((data || []) as WatchlistItem[]);
    } catch (error: any) {
      console.error('Error fetching watchlist:', error);
      toast({
        title: 'Error',
        description: 'Failed to load watchlist',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, [user]);

  return { watchlist, loading, refetch: fetchWatchlist };
}

export function useWatchlistManager() {
  const { user } = useAuth();

  const addToWatchlist = async (ticker: string, asset_type: AssetType) => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to add to watchlist',
        variant: 'destructive'
      });
      return { error: new Error('Not authenticated') };
    }

    try {
      const { error } = await supabase
        .from('watchlist')
        .insert({
          user_id: user.id,
          ticker,
          asset_type
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Added ${ticker} to watchlist`
      });

      return { error: null };
    } catch (error: any) {
      console.error('Error adding to watchlist:', error);

      let errorMessage = 'Failed to add to watchlist';
      if (error.code === '23505') {
        errorMessage = 'Ticker already in your watchlist';
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });

      return { error };
    }
  };

  const removeFromWatchlist = async (id: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Removed from watchlist'
      });

      return { error: null };
    } catch (error: any) {
      console.error('Error removing from watchlist:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove from watchlist',
        variant: 'destructive'
      });

      return { error };
    }
  };

  return { addToWatchlist, removeFromWatchlist };
}
