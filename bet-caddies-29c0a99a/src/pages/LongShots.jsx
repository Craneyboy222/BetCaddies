import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { useTrackedBets } from '@/hooks/useTrackedBets';
import { motion } from 'framer-motion';
import { Sparkles, SlidersHorizontal } from 'lucide-react';
import BetCard from '@/components/ui/BetCard';
import TourFilter from '@/components/ui/TourFilter';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import ContentGate from '@/components/ui/ContentGate';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function LongShots() {
  const [selectedTour, setSelectedTour] = useState('all');
  const [sortBy, setSortBy] = useState('confidence');
  const [user, setUser] = useState(null);
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
    queryKey: ['golfBets', 'longshots'],
    queryFn: () => api.getBetsByTier('longshots')
  });

  const providers = [];
  const { isTracked, toggleTrack } = useTrackedBets();

  let filteredBets = bets.filter(bet =>
    (selectedTour === 'all' || bet.tour === selectedTour) && (bet.odds_decimal_best || 0) > 60
  );

  if (sortBy === 'confidence') {
    filteredBets = [...filteredBets].sort((a, b) => (b.confidence_rating || 0) - (a.confidence_rating || 0));
  } else if (sortBy === 'odds') {
    filteredBets = [...filteredBets].sort((a, b) => (b.odds_decimal_best || 0) - (a.odds_decimal_best || 0));
  } else if (sortBy === 'edge') {
    filteredBets = [...filteredBets].sort((a, b) => (b.edge || 0) - (a.edge || 0));
  }


  return (
    <ContentGate resourceType="page" resourceId="long-shots" blur>
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/30 to-rose-600/20 border border-rose-500/30 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">The Long Shots</h1>
              <span className="px-2 py-0.5 text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full">Top 5 Picks</span>
            </div>
            <p className="text-slate-400">60/1 odds and over • Our best extreme longshot selections</p>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
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

      {/* Bets Grid */}
      {isLoading ? (
        <LoadingSpinner text="Loading Long Shots..." />
      ) : filteredBets.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No Long Shots Found"
          description={selectedTour === 'all'
            ? "No long shots available this week. Check back soon!"
            : `No long shots available for ${selectedTour} this week.`
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
                isAdded={isTracked(bet.id)}
                onAddBet={toggleTrack}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Count */}
      {!isLoading && filteredBets.length > 0 && (
        <div className="mt-8 text-center text-slate-500 text-sm">
          Showing our top {filteredBets.length} Long Shots
        </div>
      )}
    </div>
    </ContentGate>
  );
}
