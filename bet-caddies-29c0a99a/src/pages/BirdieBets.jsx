import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Zap, SlidersHorizontal } from 'lucide-react';
import BetCard from '@/components/ui/BetCard';
import TourFilter from '@/components/ui/TourFilter';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function BirdieBets() {
  const [selectedTour, setSelectedTour] = useState('all');
  const [sortBy, setSortBy] = useState('confidence');
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await api.auth.me();
        setUser(userData);
      } catch (e) {}
    };
    loadUser();
  }, []);

  const { data: bets = [], isLoading } = useQuery({
    queryKey: ['golfBets', 'birdie'],
    queryFn: () => api.getBetsByTier('birdie')
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.BettingProvider.filter({ enabled: true })
  });

  const { data: userBets = [] } = useQuery({
    queryKey: ['userBets'],
    queryFn: () => user ? base44.entities.UserBet.filter({ created_by: user.email }) : [],
    enabled: !!user
  });

  const addBetMutation = useMutation({
    mutationFn: (bet) => base44.entities.UserBet.create({
      golf_bet_id: bet.id,
      status: 'added'
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userBets'] })
  });

  let filteredBets = bets.filter(bet => 
    selectedTour === 'all' || bet.tour === selectedTour
  );

  if (sortBy === 'confidence') {
    filteredBets = [...filteredBets].sort((a, b) => (b.confidence_rating || 0) - (a.confidence_rating || 0));
  } else if (sortBy === 'odds') {
    filteredBets = [...filteredBets].sort((a, b) => (b.odds_decimal_best || 0) - (a.odds_decimal_best || 0));
  } else if (sortBy === 'edge') {
    filteredBets = [...filteredBets].sort((a, b) => (b.edge || 0) - (a.edge || 0));
  }

  const userBetIds = new Set(userBets.map(ub => ub.golf_bet_id));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-600/20 border border-amber-500/30 flex items-center justify-center">
            <Zap className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Birdie Bets</h1>
            <p className="text-slate-400">6/1 to 10/1 odds • Medium risk selections</p>
          </div>
        </div>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1">
          <TourFilter selected={selectedTour} onChange={setSelectedTour} />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-400" />
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40 bg-slate-800/50 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="confidence">Confidence</SelectItem>
              <SelectItem value="odds">Best Odds</SelectItem>
              <SelectItem value="edge">Edge</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner text="Loading Birdie Bets..." />
      ) : filteredBets.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No Birdie Bets Found"
          description={selectedTour === 'all' 
            ? "No Birdie Bets available this week."
            : `No Birdie Bets available for ${selectedTour} this week.`
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBets.map((bet, idx) => (
            <motion.div
              key={bet.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <BetCard
                bet={bet}
                providers={providers}
                isAdded={userBetIds.has(bet.id)}
                onAddBet={(b) => addBetMutation.mutate(b)}
              />
            </motion.div>
          ))}
        </div>
      )}

      {!isLoading && filteredBets.length > 0 && (
        <div className="mt-8 text-center text-slate-500 text-sm">
          Showing {filteredBets.length} of {bets.length} Birdie Bets
        </div>
      )}
    </div>
  );
}