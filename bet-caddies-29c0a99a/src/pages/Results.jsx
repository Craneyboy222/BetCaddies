import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format, subWeeks } from 'date-fns';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Zap, 
  Trophy,
  Calendar,
  ChevronDown
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
  eagle: Trophy
};

const categoryColors = {
  par: 'text-emerald-400',
  birdie: 'text-amber-400',
  eagle: 'text-violet-400'
};

export default function Results() {
  const [selectedWeek, setSelectedWeek] = useState('all');

  const { data: settledBets = [], isLoading } = useQuery({
    queryKey: ['settledBets'],
    queryFn: () => base44.entities.GolfBet.filter(
      { status: { $in: ['settled_won', 'settled_lost', 'settled_void', 'settled_push'] } },
      '-settled_at',
      500
    )
  });

  // Get unique weeks
  const weeks = [...new Set(settledBets.map(b => b.run_id))].filter(Boolean);

  // Filter by week
  const filteredBets = selectedWeek === 'all' 
    ? settledBets 
    : settledBets.filter(b => b.run_id === selectedWeek);

  // Calculate stats
  const stats = {
    total: filteredBets.length,
    won: filteredBets.filter(b => b.status === 'settled_won').length,
    lost: filteredBets.filter(b => b.status === 'settled_lost').length,
    void: filteredBets.filter(b => b.status === 'settled_void' || b.status === 'settled_push').length
  };

  stats.hitRate = stats.total > 0 ? ((stats.won / (stats.won + stats.lost)) * 100).toFixed(1) : 0;

  // Category breakdown
  const categoryStats = ['par', 'birdie', 'eagle'].map(cat => {
    const catBets = filteredBets.filter(b => b.category === cat);
    const won = catBets.filter(b => b.status === 'settled_won').length;
    const lost = catBets.filter(b => b.status === 'settled_lost').length;
    const total = won + lost;
    return {
      category: cat,
      total: catBets.length,
      won,
      lost,
      hitRate: total > 0 ? ((won / total) * 100).toFixed(1) : 0
    };
  });

  // Tour breakdown
  const tours = ['PGA', 'DPWT', 'LPGA', 'LIV', 'KFT'];
  const tourStats = tours.map(tour => {
    const tourBets = filteredBets.filter(b => b.tour === tour);
    const won = tourBets.filter(b => b.status === 'settled_won').length;
    const lost = tourBets.filter(b => b.status === 'settled_lost').length;
    const total = won + lost;
    return {
      tour,
      total: tourBets.length,
      won,
      lost,
      hitRate: total > 0 ? ((won / total) * 100).toFixed(1) : 0
    };
  }).filter(t => t.total > 0);

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
            <BarChart3 className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Results</h1>
            <p className="text-slate-400">Historical performance and transparency</p>
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
            {weeks.map(week => (
              <SelectItem key={week} value={week}>
                {week.replace('weekly_', 'Week of ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingSpinner text="Loading results..." />
      ) : filteredBets.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No Results Yet"
          description="Results will appear here after bets are settled."
        />
      ) : (
        <>
          {/* Overall Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
              <div className="text-3xl font-bold text-white">{stats.total}</div>
              <div className="text-sm text-slate-400 mt-1">Total Settled</div>
            </div>
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
              <div className="text-3xl font-bold text-emerald-400">{stats.won}</div>
              <div className="text-sm text-slate-400 mt-1">Winners</div>
            </div>
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
              <div className="text-3xl font-bold text-red-400">{stats.lost}</div>
              <div className="text-sm text-slate-400 mt-1">Losers</div>
            </div>
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
              <div className="text-3xl font-bold text-amber-400">{stats.void}</div>
              <div className="text-sm text-slate-400 mt-1">Void/Push</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-xl border border-emerald-500/30 p-5">
              <div className="text-3xl font-bold text-emerald-400">{stats.hitRate}%</div>
              <div className="text-sm text-slate-400 mt-1">Hit Rate</div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="mb-10">
            <h2 className="text-xl font-bold text-white mb-4">By Category</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {categoryStats.map((cat, idx) => {
                const Icon = categoryIcons[cat.category];
                return (
                  <motion.div
                    key={cat.category}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <Icon className={`w-5 h-5 ${categoryColors[cat.category]}`} />
                      <span className="text-lg font-semibold text-white capitalize">{cat.category} Bets</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-xl font-bold text-emerald-400">{cat.won}</div>
                        <div className="text-xs text-slate-500">Won</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-red-400">{cat.lost}</div>
                        <div className="text-xs text-slate-500">Lost</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-white">{cat.hitRate}%</div>
                        <div className="text-xs text-slate-500">Hit Rate</div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Tour Breakdown */}
          {tourStats.length > 0 && (
            <div className="mb-10">
              <h2 className="text-xl font-bold text-white mb-4">By Tour</h2>
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left px-5 py-3 text-sm font-medium text-slate-400">Tour</th>
                      <th className="text-center px-5 py-3 text-sm font-medium text-slate-400">Total</th>
                      <th className="text-center px-5 py-3 text-sm font-medium text-slate-400">Won</th>
                      <th className="text-center px-5 py-3 text-sm font-medium text-slate-400">Lost</th>
                      <th className="text-center px-5 py-3 text-sm font-medium text-slate-400">Hit Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tourStats.map((tour, idx) => (
                      <tr key={tour.tour} className={idx !== tourStats.length - 1 ? 'border-b border-slate-700/30' : ''}>
                        <td className="px-5 py-4 font-medium text-white">{tour.tour}</td>
                        <td className="px-5 py-4 text-center text-slate-300">{tour.total}</td>
                        <td className="px-5 py-4 text-center text-emerald-400">{tour.won}</td>
                        <td className="px-5 py-4 text-center text-red-400">{tour.lost}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`font-semibold ${parseFloat(tour.hitRate) >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {tour.hitRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Settled */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Recent Results</h2>
            <div className="space-y-3">
              {filteredBets.slice(0, 20).map((bet, idx) => (
                <motion.div
                  key={bet.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      bet.status === 'settled_won' 
                        ? 'bg-emerald-500/20' 
                        : bet.status === 'settled_lost'
                        ? 'bg-red-500/20'
                        : 'bg-amber-500/20'
                    }`}>
                      {bet.status === 'settled_won' ? (
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                      ) : bet.status === 'settled_lost' ? (
                        <TrendingDown className="w-5 h-5 text-red-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-amber-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{bet.selection_name}</div>
                      <div className="text-sm text-slate-400">
                        {bet.bet_title} • {bet.tournament_name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600">
                      {bet.tour}
                    </Badge>
                    <Badge variant="outline" className={`capitalize ${categoryColors[bet.category]} bg-transparent border-current/30`}>
                      {bet.category}
                    </Badge>
                    <div className="text-right">
                      <div className="font-bold text-white">{bet.odds_display_best}</div>
                      {bet.result_position && (
                        <div className="text-xs text-slate-500">Finished: {bet.result_position}</div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}