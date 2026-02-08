import { useState, useMemo } from 'react';
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
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle
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

const OutcomeBadge = ({ outcome }) => {
  if (outcome === 'won') {
    return (
      <Badge className="bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 font-bold px-3 py-1">
        <CheckCircle className="w-4 h-4 mr-1" />
        WON
      </Badge>
    );
  }
  if (outcome === 'lost') {
    return (
      <Badge className="bg-red-500/20 text-red-400 border border-red-500/50 px-2 py-0.5 text-xs">
        <XCircle className="w-3 h-3 mr-1" />
        Lost
      </Badge>
    );
  }
  return (
    <Badge className="bg-slate-500/20 text-slate-400 border border-slate-500/50 px-2 py-0.5 text-xs">
      Pending
    </Badge>
  );
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
  const stats = resultsData?.stats || { total: 0, totalPicks: 0, wins: 0, losses: 0, winRate: 0 };
  const categoryStats = resultsData?.categoryStats || [];
  const tourStats = resultsData?.tourStats || [];
  const availableWeeks = resultsData?.availableWeeks || [];

  // Separate and sort picks - wins first (by odds), then losses (by odds)
  const { winningPicks, losingPicks, pendingPicks } = useMemo(() => {
    const wins = picks.filter(p => p.outcome === 'won').sort((a, b) => (b.odds_decimal_best || 0) - (a.odds_decimal_best || 0));
    const losses = picks.filter(p => p.outcome === 'lost').sort((a, b) => (b.odds_decimal_best || 0) - (a.odds_decimal_best || 0));
    const pending = picks.filter(p => !p.outcome || p.outcome === 'pending');
    return { winningPicks: wins, losingPicks: losses, pendingPicks: pending };
  }, [picks]);

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
          {/* Win/Loss Summary - Hero Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-6 bg-gradient-to-r from-emerald-900/40 via-slate-800/50 to-rose-900/20 rounded-2xl border border-emerald-500/30"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-5xl font-bold text-emerald-400">{stats.wins || 0}</div>
                <div className="text-emerald-300 font-medium mt-1 flex items-center justify-center gap-1">
                  <Trophy className="w-4 h-4" />
                  Winners
                </div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold text-red-400">{stats.losses || 0}</div>
                <div className="text-red-300 font-medium mt-1 flex items-center justify-center gap-1">
                  <XCircle className="w-4 h-4" />
                  Losses
                </div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold text-white">{stats.total || 0}</div>
                <div className="text-slate-400 font-medium mt-1">Total Picks</div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold text-amber-400">
                  {stats.winRate || 0}%
                </div>
                <div className="text-amber-300 font-medium mt-1 flex items-center justify-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  Win Rate
                </div>
              </div>
            </div>
          </motion.div>

          {/* Category Breakdown with Win Stats */}
          {categoryStats.filter(c => c.total > 0).length > 0 && (
            <div className="mb-10">
              <h2 className="text-xl font-bold text-white mb-4">By Category</h2>
              <div className="grid md:grid-cols-4 gap-4">
                {categoryStats.filter(c => c.total > 0).map((cat, idx) => {
                  const Icon = categoryIcons[cat.category] || Target;
                  const winRate = cat.total > 0 ? ((cat.wins || 0) / cat.total * 100).toFixed(0) : 0;
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
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-emerald-400">{cat.wins || 0}</span>
                        <span className="text-slate-400">/ {cat.total}</span>
                        <span className="text-sm text-slate-500">({winRate}%)</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tour Breakdown with Wins */}
          {tourStats.length > 0 && (
            <div className="mb-10">
              <h2 className="text-xl font-bold text-white mb-4">By Tour</h2>
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left px-5 py-3 text-sm font-medium text-slate-400">Tour</th>
                      <th className="text-center px-5 py-3 text-sm font-medium text-slate-400">Total</th>
                      <th className="text-center px-5 py-3 text-sm font-medium text-emerald-400">Wins</th>
                      <th className="text-center px-5 py-3 text-sm font-medium text-red-400">Losses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tourStats.map((tour, idx) => (
                      <tr key={tour.tour} className={idx !== tourStats.length - 1 ? 'border-b border-slate-700/30' : ''}>
                        <td className="px-5 py-4 font-medium text-white">{tour.tour}</td>
                        <td className="px-5 py-4 text-center text-slate-300 font-semibold">{tour.total}</td>
                        <td className="px-5 py-4 text-center text-emerald-400 font-semibold">{tour.wins || 0}</td>
                        <td className="px-5 py-4 text-center text-red-400 font-semibold">{tour.losses || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* WINNING PICKS - Prominent Display */}
          {winningPicks.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <Trophy className="w-7 h-7 text-emerald-400" />
                <h2 className="text-2xl font-bold text-emerald-400">Winners ({winningPicks.length})</h2>
              </div>
              
              <div className="space-y-4">
                {winningPicks.map((bet, idx) => (
                    <motion.div
                      key={bet.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                      className="bg-gradient-to-r from-emerald-900/40 to-slate-800/50 rounded-xl border-2 border-emerald-500/50 p-5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-xl bg-emerald-500/30 flex items-center justify-center">
                          <Trophy className="w-7 h-7 text-emerald-400" />
                        </div>
                        <div>
                          <div className="font-bold text-white text-xl">{bet.selection_name}</div>
                          <div className="text-sm text-emerald-300 font-medium">
                            {bet.market_key?.toUpperCase() || bet.bet_title}
                            {bet.final_position && <span className="ml-2">• Finished #{bet.final_position}</span>}
                            {bet.player_status && <span className="ml-2">• {bet.player_status}</span>}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {bet.tournament_name}
                            {bet.tournament_end_date && (
                              <span> • {format(new Date(bet.tournament_end_date), 'MMM d, yyyy')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600">
                          {bet.tour}
                        </Badge>
                        <div className="text-right">
                          <div className="font-bold text-emerald-400 text-2xl">@ {bet.odds_display_best}</div>
                          <OutcomeBadge outcome="won" />
                        </div>
                      </div>
                    </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* LOSING PICKS - Smaller, Less Prominent */}
          {losingPicks.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-5 h-5 text-slate-500" />
                <h2 className="text-lg font-medium text-slate-500">Losses ({losingPicks.length})</h2>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                {losingPicks.map((bet, idx) => (
                  <motion.div
                    key={bet.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.01, 0.3) }}
                    className="bg-slate-800/20 rounded-lg border border-slate-700/30 p-3 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-400 text-sm truncate">{bet.selection_name}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {bet.market_key?.toUpperCase()} • {bet.tournament_name?.split(' ').slice(0, 2).join(' ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-slate-500 text-sm">@ {bet.odds_display_best}</span>
                      <OutcomeBadge outcome="lost" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* PENDING PICKS - if any */}
          {pendingPicks.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-slate-400" />
                <h2 className="text-lg font-medium text-slate-400">Pending Settlement ({pendingPicks.length})</h2>
              </div>
              
              <div className="text-sm text-slate-500 mb-3">
                Awaiting final results data to determine outcomes.
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                {pendingPicks.slice(0, 12).map((bet) => (
                  <div
                    key={bet.id}
                    className="bg-slate-800/20 rounded-lg border border-slate-700/30 p-3"
                  >
                    <div className="font-medium text-slate-400 text-sm truncate">{bet.selection_name}</div>
                    <div className="text-xs text-slate-500">
                      {bet.market_key?.toUpperCase()} @ {bet.odds_display_best}
                    </div>
                  </div>
                ))}
                {pendingPicks.length > 12 && (
                  <div className="text-slate-500 text-sm flex items-center justify-center">
                    +{pendingPicks.length - 12} more
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}