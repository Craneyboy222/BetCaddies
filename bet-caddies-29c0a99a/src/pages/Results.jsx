import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Zap, 
  Trophy,
  Calendar,
  ChevronDown,
  ChevronUp,
  Award,
  Minus,
  Eye,
  EyeOff
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
  const [showLosses, setShowLosses] = useState(false);
  const [expandedSection, setExpandedSection] = useState('winners');

  // Fetch settled results from backend with 5-minute auto-refresh
  const { data: resultsData, isLoading, error } = useQuery({
    queryKey: ['settledResults', selectedWeek],
    queryFn: () => api.getSettledResults(selectedWeek),
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
  });

  const settledBets = resultsData?.data || [];
  const stats = resultsData?.stats || { total: 0, won: 0, lost: 0, void: 0, hitRate: 0 };
  const categoryStats = resultsData?.categoryStats || [];
  const tourStats = resultsData?.tourStats || [];
  const availableWeeks = resultsData?.availableWeeks || [];

  // Separate winners from other results
  const winners = settledBets.filter(b => b.status === 'settled_won');
  const losses = settledBets.filter(b => b.status === 'settled_lost');
  const voidPush = settledBets.filter(b => b.status === 'settled_void' || b.status === 'settled_push');

  // Sort winners by odds (higher odds = bigger win = more prominent)
  const sortedWinners = [...winners].sort((a, b) => (b.odds_decimal_best || 0) - (a.odds_decimal_best || 0));

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
            {availableWeeks.map(week => (
              <SelectItem key={week} value={week}>
                {week.replace('weekly_', 'Week of ').replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingSpinner text="Loading results..." />
      ) : error ? (
        <EmptyState
          icon={BarChart3}
          title="Error Loading Results"
          description="Could not fetch results. Please try again later."
        />
      ) : settledBets.length === 0 ? (
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
            <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl border border-emerald-500/30 p-5">
              <div className="text-3xl font-bold text-emerald-400">{stats.won}</div>
              <div className="text-sm text-emerald-300/70 mt-1">Winners 🎉</div>
            </div>
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
              <div className="text-3xl font-bold text-slate-400">{stats.lost}</div>
              <div className="text-sm text-slate-500 mt-1">Losers</div>
            </div>
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
              <div className="text-3xl font-bold text-amber-400">{stats.void}</div>
              <div className="text-sm text-slate-400 mt-1">Void/Push</div>
            </div>
            <div className="bg-gradient-to-br from-teal-500/20 to-emerald-500/10 rounded-xl border border-teal-500/30 p-5">
              <div className="text-3xl font-bold text-teal-400">{stats.hitRate}%</div>
              <div className="text-sm text-slate-400 mt-1">Hit Rate</div>
            </div>
          </div>

          {/* Category Breakdown */}
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
                    className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <Icon className={`w-5 h-5 ${categoryColors[cat.category] || 'text-slate-400'}`} />
                      <span className="text-lg font-semibold text-white capitalize">{cat.category} Bets</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-xl font-bold text-emerald-400">{cat.won}</div>
                        <div className="text-xs text-slate-500">Won</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-slate-400">{cat.lost}</div>
                        <div className="text-xs text-slate-500">Lost</div>
                      </div>
                      <div>
                        <div className={`text-xl font-bold ${parseFloat(cat.hitRate) >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {cat.hitRate}%
                        </div>
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
                        <td className="px-5 py-4 text-center text-slate-400">{tour.lost}</td>
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

          {/* WINNERS SECTION - Most Prominent */}
          {winners.length > 0 && (
            <div className="mb-10">
              <div 
                className="flex items-center justify-between cursor-pointer mb-4"
                onClick={() => setExpandedSection(expandedSection === 'winners' ? null : 'winners')}
              >
                <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-emerald-400" />
                  <h2 className="text-xl font-bold text-white">Winners ({winners.length})</h2>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    💰 Cash Results
                  </Badge>
                </div>
                {expandedSection === 'winners' ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>
              
              <AnimatePresence>
                {expandedSection === 'winners' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    {sortedWinners.map((bet, idx) => {
                      const Icon = categoryIcons[bet.category] || Target;
                      return (
                        <motion.div
                          key={bet.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className={`bg-gradient-to-r from-emerald-500/10 to-transparent rounded-xl border border-emerald-500/30 p-4 flex items-center justify-between ${
                            idx < 3 ? 'ring-2 ring-emerald-500/20' : ''
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                              <TrendingUp className="w-6 h-6 text-emerald-400" />
                            </div>
                            <div>
                              <div className="font-semibold text-white text-lg">{bet.selection_name}</div>
                              <div className="text-sm text-slate-400">
                                {bet.bet_title} • {bet.tournament_name}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600">
                              {bet.tour}
                            </Badge>
                            <Badge variant="outline" className={`capitalize ${categoryBgColors[bet.category] || ''} ${categoryColors[bet.category] || 'text-slate-400'}`}>
                              <Icon className="w-3 h-3 mr-1" />
                              {bet.category}
                            </Badge>
                            <div className="text-right min-w-[80px]">
                              <div className="font-bold text-emerald-400 text-lg">@ {bet.odds_display_best}</div>
                              <div className="text-xs text-emerald-300/70">✓ Winner</div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* VOID/PUSH SECTION */}
          {voidPush.length > 0 && (
            <div className="mb-10">
              <div 
                className="flex items-center justify-between cursor-pointer mb-4"
                onClick={() => setExpandedSection(expandedSection === 'void' ? null : 'void')}
              >
                <div className="flex items-center gap-3">
                  <Minus className="w-5 h-5 text-amber-400" />
                  <h2 className="text-lg font-semibold text-slate-300">Void / Push ({voidPush.length})</h2>
                </div>
                {expandedSection === 'void' ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>
              
              <AnimatePresence>
                {expandedSection === 'void' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    {voidPush.map((bet, idx) => (
                      <motion.div
                        key={bet.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className="bg-slate-800/20 rounded-lg border border-slate-700/30 p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center">
                            <Minus className="w-4 h-4 text-amber-400" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-300">{bet.selection_name}</div>
                            <div className="text-xs text-slate-500">{bet.tournament_name}</div>
                          </div>
                        </div>
                        <div className="text-sm text-amber-400">Void</div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* LOSSES SECTION - Collapsed by default, subtle */}
          {losses.length > 0 && (
            <div className="mb-10">
              <div 
                className="flex items-center justify-between cursor-pointer mb-4 opacity-60 hover:opacity-100 transition-opacity"
                onClick={() => setShowLosses(!showLosses)}
              >
                <div className="flex items-center gap-3">
                  {showLosses ? (
                    <Eye className="w-5 h-5 text-slate-500" />
                  ) : (
                    <EyeOff className="w-5 h-5 text-slate-500" />
                  )}
                  <h2 className="text-lg font-medium text-slate-500">Losses ({losses.length})</h2>
                  <span className="text-xs text-slate-600">Click to {showLosses ? 'hide' : 'show'}</span>
                </div>
                {showLosses ? (
                  <ChevronUp className="w-5 h-5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-500" />
                )}
              </div>
              
              <AnimatePresence>
                {showLosses && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    {losses.map((bet, idx) => (
                      <motion.div
                        key={bet.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.6 }}
                        transition={{ delay: idx * 0.01 }}
                        className="bg-slate-900/30 rounded-lg border border-slate-800/50 p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-slate-800/50 flex items-center justify-center">
                            <TrendingDown className="w-4 h-4 text-slate-500" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-400">{bet.selection_name}</div>
                            <div className="text-xs text-slate-600">
                              {bet.bet_title} • {bet.tournament_name}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-slate-600">{bet.tour}</span>
                          <span className="text-sm text-slate-500">@ {bet.odds_display_best}</span>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}