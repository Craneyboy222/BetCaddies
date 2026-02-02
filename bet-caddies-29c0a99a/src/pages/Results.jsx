import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { 
  BarChart3, 
  Target, 
  Zap, 
  Trophy,
  Calendar,
  Award,
  Clock,
  Star
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

const categoryIcons = {
  par: Target,
  birdie: Zap,
  eagle: Trophy,
  longshots: Award
};

const categoryColors = {
  par: 'text-emerald-400',
  birdie: 'text-amber-400',
  eagle: 'text-violet-400',
  longshots: 'text-rose-400'
};

const categoryBgColors = {
  par: 'bg-emerald-500/20 border-emerald-500/30',
  birdie: 'bg-amber-500/20 border-amber-500/30',
  eagle: 'bg-violet-500/20 border-violet-500/30',
  longshots: 'bg-rose-500/20 border-rose-500/30'
};

export default function Results() {
  const [selectedWeek, setSelectedWeek] = useState('all');

  // Fetch historical picks from completed tournaments
  const { data: resultsData, isLoading, error } = useQuery({
    queryKey: ['historicalPicks', selectedWeek],
    queryFn: () => api.getSettledResults(selectedWeek),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const picks = resultsData?.data || [];
  const stats = resultsData?.stats || { total: 0, totalPicks: 0 };
  const categoryStats = resultsData?.categoryStats || [];
  const tourStats = resultsData?.tourStats || [];
  const availableWeeks = resultsData?.availableWeeks || [];

  // Sort picks by odds (higher odds = more impressive picks shown first)
  const sortedPicks = [...picks].sort((a, b) => (b.odds_decimal_best || 0) - (a.odds_decimal_best || 0));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500/30 to-emerald-500/20 border border-teal-500/30 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Our Picks</h1>
            <p className="text-slate-400">Historical selections from completed tournaments</p>
          </div>
        </div>
      </motion.div>

      {/* Week Filter */}
      <div className="flex items-center gap-4 mb-8">
        <Calendar className="w-4 h-4 text-slate-400" />
        <Select value={selectedWeek} onValueChange={setSelectedWeek}>
          <SelectTrigger className="w-56 bg-slate-800/50 border-slate-700 text-white">
            <SelectValue placeholder="Select week" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            {availableWeeks.map(week => (
              <SelectItem key={week} value={week}>
                {week.replace('weekly_', 'Week of ').replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingSpinner text="Loading picks..." />
      ) : error ? (
        <EmptyState
          icon={BarChart3}
          title="Error Loading Picks"
          description="Could not fetch historical picks. Please try again later."
        />
      ) : picks.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No Historical Picks Yet"
          description="Picks from completed tournaments will appear here. Check back after your first tournament ends!"
        />
      ) : (
        <>
          {/* Overall Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
            <div className="bg-gradient-to-br from-teal-500/20 to-emerald-500/10 rounded-xl border border-teal-500/30 p-5">
              <div className="text-3xl font-bold text-teal-400">{stats.total}</div>
              <div className="text-sm text-slate-400 mt-1">Total Picks</div>
            </div>
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
              <div className="text-3xl font-bold text-white">{tourStats.length}</div>
              <div className="text-sm text-slate-400 mt-1">Tours Covered</div>
            </div>
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
              <div className="text-3xl font-bold text-white">{availableWeeks.length}</div>
              <div className="text-sm text-slate-400 mt-1">Weeks of Data</div>
            </div>
          </div>

          {/* Category Breakdown */}
          {categoryStats.filter(c => c.total > 0).length > 0 && (
            <div className="mb-10">
              <h2 className="text-xl font-bold text-white mb-4">By Category</h2>
              <div className="grid md:grid-cols-4 gap-4">
                {categoryStats.filter(c => c.total > 0).map((cat, idx) => {
                  const Icon = categoryIcons[cat.category] || Target;
                  return (
                    <motion.div
                      key={cat.category}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`rounded-xl border p-5 ${categoryBgColors[cat.category] || 'bg-slate-800/30 border-slate-700/50'}`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <Icon className={`w-5 h-5 ${categoryColors[cat.category] || 'text-slate-400'}`} />
                        <span className="text-lg font-semibold text-white capitalize">{cat.category}</span>
                      </div>
                      <div className="text-2xl font-bold text-white">{cat.total} picks</div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tour Breakdown */}
          {tourStats.length > 0 && (
            <div className="mb-10">
              <h2 className="text-xl font-bold text-white mb-4">By Tour</h2>
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left px-5 py-3 text-sm font-medium text-slate-400">Tour</th>
                      <th className="text-center px-5 py-3 text-sm font-medium text-slate-400">Total Picks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tourStats.map((tour, idx) => (
                      <tr key={tour.tour} className={idx !== tourStats.length - 1 ? 'border-b border-slate-700/30' : ''}>
                        <td className="px-5 py-4 font-medium text-white">{tour.tour}</td>
                        <td className="px-5 py-4 text-center text-teal-400 font-semibold">{tour.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* All Historical Picks */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <Star className="w-6 h-6 text-amber-400" />
              <h2 className="text-xl font-bold text-white">Historical Picks ({picks.length})</h2>
            </div>
            
            <div className="space-y-3">
              {sortedPicks.map((bet, idx) => {
                const Icon = categoryIcons[bet.category] || Target;
                return (
                  <motion.div
                    key={bet.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                    className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 flex items-center justify-between hover:border-slate-600/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${categoryBgColors[bet.category] || 'bg-slate-700/50'}`}>
                        <Icon className={`w-6 h-6 ${categoryColors[bet.category] || 'text-slate-400'}`} />
                      </div>
                      <div>
                        <div className="font-semibold text-white text-lg">{bet.selection_name}</div>
                        <div className="text-sm text-slate-400">
                          {bet.bet_title}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {bet.tournament_name}
                          {bet.tournament_end_date && (
                            <span> • Ended {format(new Date(bet.tournament_end_date), 'MMM d, yyyy')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600">
                        {bet.tour}
                      </Badge>
                      <Badge variant="outline" className={`capitalize ${categoryBgColors[bet.category] || ''} ${categoryColors[bet.category] || 'text-slate-400'}`}>
                        {bet.category}
                      </Badge>
                      <div className="text-right min-w-[80px]">
                        <div className="font-bold text-white text-lg">@ {bet.odds_display_best}</div>
                        <div className="text-xs text-slate-500">
                          {bet.confidence_rating && `${bet.confidence_rating}/5 confidence`}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}