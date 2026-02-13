import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, Target, Zap, Trophy, Sparkles,
  Award, Flame, Calendar, PoundSterling, Percent
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import SEOHead from '@/components/SEOHead';

const STAKE = 10;

const tierConfig = {
  par:       { label: 'Par',        icon: Target,   color: '#10b981', bg: 'from-emerald-900/50 to-emerald-800/20', border: 'border-emerald-500/30' },
  birdie:    { label: 'Birdie',     icon: Zap,      color: '#f59e0b', bg: 'from-amber-900/50 to-amber-800/20',   border: 'border-amber-500/30' },
  eagle:     { label: 'Eagle',      icon: Trophy,   color: '#8b5cf6', bg: 'from-violet-900/50 to-violet-800/20',  border: 'border-violet-500/30' },
  longshots: { label: 'Long Shots', icon: Sparkles, color: '#f43f5e', bg: 'from-rose-900/50 to-rose-800/20',    border: 'border-rose-500/30' },
};

function computePerformanceData(resultsData) {
  if (!resultsData) return null;

  const bets = resultsData.data || [];
  const weeklyStats = resultsData.weeklyStats || [];
  const settled = bets.filter(b => b.outcome === 'won' || b.outcome === 'lost');

  // — ROI —
  const totalStake = settled.length * STAKE;
  const totalProfit = settled.reduce((sum, b) => {
    if (b.outcome === 'won') return sum + (STAKE * ((b.odds_decimal_best || 2) - 1));
    return sum - STAKE;
  }, 0);
  const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;

  // — Monthly P&L —
  const monthMap = new Map();
  for (const w of weeklyStats) {
    if (!w.weekStart) continue;
    const d = new Date(w.weekStart);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    if (!monthMap.has(key)) monthMap.set(key, { key, label, profit: 0, wins: 0, losses: 0, picks: 0 });
    const m = monthMap.get(key);
    m.profit += w.weekWinnings;
    m.wins += w.wins;
    m.losses += w.losses;
    m.picks += w.totalPicks;
  }
  const monthlyStats = [...monthMap.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(m => ({ ...m, profit: Math.round(m.profit * 100) / 100 }));

  // — Streaks —
  const chronological = [...settled].sort((a, b) =>
    new Date(a.created_at || 0) - new Date(b.created_at || 0)
  );
  let currentStreak = 0, currentStreakType = null;
  let bestWinStreak = 0, worstLossStreak = 0, tempStreak = 0, tempType = null;
  for (const b of chronological) {
    if (b.outcome === tempType) {
      tempStreak++;
    } else {
      tempType = b.outcome;
      tempStreak = 1;
    }
    if (tempType === 'won' && tempStreak > bestWinStreak) bestWinStreak = tempStreak;
    if (tempType === 'lost' && tempStreak > worstLossStreak) worstLossStreak = tempStreak;
    currentStreak = tempStreak;
    currentStreakType = tempType;
  }

  // — Market breakdown —
  const marketMap = new Map();
  for (const b of settled) {
    const mk = (b.market_key || 'unknown').toLowerCase();
    if (!marketMap.has(mk)) marketMap.set(mk, { market: mk, wins: 0, losses: 0, total: 0, profit: 0 });
    const m = marketMap.get(mk);
    m.total++;
    if (b.outcome === 'won') {
      m.wins++;
      m.profit += STAKE * ((b.odds_decimal_best || 2) - 1);
    } else {
      m.losses++;
      m.profit -= STAKE;
    }
  }
  const marketStats = [...marketMap.values()]
    .sort((a, b) => b.total - a.total)
    .map(m => ({ ...m, profit: Math.round(m.profit * 100) / 100, winRate: m.total > 0 ? (m.wins / m.total * 100).toFixed(1) : 0 }));

  // — Best & worst week —
  const bestWeek = weeklyStats.reduce((best, w) => (!best || w.weekWinnings > best.weekWinnings) ? w : best, null);
  const worstWeek = weeklyStats.reduce((worst, w) => (!worst || w.weekWinnings < worst.weekWinnings) ? w : worst, null);

  return {
    roi: Math.round(roi * 10) / 10,
    totalProfit: Math.round(totalProfit * 100) / 100,
    totalBets: settled.length,
    monthlyStats,
    weeklyStats,
    streaks: { currentStreak, currentStreakType, bestWinStreak, worstLossStreak },
    marketStats,
    bestWeek,
    worstWeek,
    categoryStats: resultsData.categoryStats || [],
    tourStats: resultsData.tourStats || [],
    stats: resultsData.stats || {},
  };
}

const MARKET_LABELS = {
  win: 'Outright Winner',
  top_5: 'Top 5',
  top_10: 'Top 10',
  top_20: 'Top 20',
  make_cut: 'Make Cut',
  frl: 'First Round Leader',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm shadow-xl">
      <div className="text-slate-300 font-medium mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className={`font-semibold ${p.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {p.name === 'P&L' ? `£${p.value.toFixed(2)}` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

function PerformanceSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[0, 1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
      <div className="grid md:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

export default function Performance() {
  const { data: resultsData, isLoading } = useQuery({
    queryKey: ['historicalPicks', 'all'],
    queryFn: () => api.getSettledResults('all'),
    staleTime: 5 * 60 * 1000,
  });

  const perf = useMemo(() => computePerformanceData(resultsData), [resultsData]);

  if (isLoading || !perf) {
    return (
      <>
        <SEOHead
          title="Performance Dashboard"
          description="Transparent track record of all BetCaddies golf betting picks. All-time ROI, monthly P&L, win rates by tier, market, and tour."
          path="/Performance"
        />
        <PerformanceSkeleton />
      </>
    );
  }

  const { roi, totalProfit, totalBets, monthlyStats, weeklyStats, streaks, marketStats, categoryStats, tourStats, stats, bestWeek, worstWeek } = perf;

  return (
    <>
      <SEOHead
        title="Performance Dashboard"
        description="Transparent track record of all BetCaddies golf betting picks. All-time ROI, monthly P&L, win rates by tier, market, and tour."
        path="/Performance"
      />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Performance Dashboard</h1>
              <p className="text-slate-400">Transparent track record across all picks</p>
            </div>
          </div>
        </motion.div>

        {/* Hero Stats */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-gradient-to-br from-emerald-900/50 to-emerald-800/20 rounded-2xl border border-emerald-500/30 p-5 text-center">
              <div className={`text-3xl font-bold ${roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {roi >= 0 ? '+' : ''}{roi}%
              </div>
              <div className="text-emerald-300 text-sm mt-1 flex items-center justify-center gap-1">
                <Percent className="w-3.5 h-3.5" /> ROI
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/20 rounded-2xl border border-blue-500/30 p-5 text-center">
              <div className={`text-3xl font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totalProfit >= 0 ? '+' : ''}£{Math.abs(totalProfit).toFixed(0)}
              </div>
              <div className="text-blue-300 text-sm mt-1 flex items-center justify-center gap-1">
                <PoundSterling className="w-3.5 h-3.5" /> Total P&L
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-900/50 to-amber-800/20 rounded-2xl border border-amber-500/30 p-5 text-center">
              <div className="text-3xl font-bold text-amber-400">{stats.winRate || 0}%</div>
              <div className="text-amber-300 text-sm mt-1 flex items-center justify-center gap-1">
                <Target className="w-3.5 h-3.5" /> Win Rate
              </div>
            </div>

            <div className="bg-gradient-to-br from-violet-900/50 to-violet-800/20 rounded-2xl border border-violet-500/30 p-5 text-center">
              <div className="text-3xl font-bold text-violet-400">{totalBets}</div>
              <div className="text-violet-300 text-sm mt-1 flex items-center justify-center gap-1">
                <Award className="w-3.5 h-3.5" /> Settled Bets
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-900/50 to-orange-800/20 rounded-2xl border border-orange-500/30 p-5 text-center">
              <div className="text-3xl font-bold text-orange-400">
                {streaks.currentStreak}
                <span className="text-lg ml-1">{streaks.currentStreakType === 'won' ? 'W' : 'L'}</span>
              </div>
              <div className="text-orange-300 text-sm mt-1 flex items-center justify-center gap-1">
                <Flame className="w-3.5 h-3.5" /> Current Streak
              </div>
            </div>
          </div>

          <p className="text-slate-500 text-xs text-center mt-3">
            All figures based on a flat £{STAKE} stake per bet.
          </p>
        </motion.div>

        {/* Cumulative P&L Chart */}
        {weeklyStats.length > 1 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Cumulative P&L</h2>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={weeklyStats.map(w => ({
                  label: w.weekKey?.replace('weekly_', '').replace(/_/g, '/'),
                  total: w.runningTotal
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `£${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="P&L"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ fill: '#10b981', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* Monthly P&L Bar Chart */}
        {monthlyStats.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Monthly P&L</h2>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `£${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="profit" name="P&L" radius={[6, 6, 0, 0]}>
                    {monthlyStats.map((entry, i) => (
                      <Cell key={i} fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Streaks Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-xl font-bold text-white mb-4">Streaks</h2>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Best Win Streak</span>
                <span className="text-emerald-400 font-bold text-xl">{streaks.bestWinStreak}W</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Worst Loss Streak</span>
                <span className="text-red-400 font-bold text-xl">{streaks.worstLossStreak}L</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Current Streak</span>
                <span className={`font-bold text-xl ${streaks.currentStreakType === 'won' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {streaks.currentStreak}{streaks.currentStreakType === 'won' ? 'W' : 'L'}
                </span>
              </div>
              {bestWeek && (
                <>
                  <hr className="border-slate-700/50" />
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Best Week</span>
                    <div className="text-right">
                      <span className="text-emerald-400 font-bold">+£{bestWeek.weekWinnings?.toFixed(2)}</span>
                      <div className="text-xs text-slate-500">{bestWeek.weekKey?.replace('weekly_', '').replace(/_/g, '/')}</div>
                    </div>
                  </div>
                </>
              )}
              {worstWeek && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Worst Week</span>
                  <div className="text-right">
                    <span className="text-red-400 font-bold">£{worstWeek.weekWinnings?.toFixed(2)}</span>
                    <div className="text-xs text-slate-500">{worstWeek.weekKey?.replace('weekly_', '').replace(/_/g, '/')}</div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Win Rate by Market */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <h2 className="text-xl font-bold text-white mb-4">By Market</h2>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 space-y-3">
              {marketStats.map(m => (
                <div key={m.market} className="flex items-center justify-between">
                  <div>
                    <span className="text-white font-medium text-sm">{MARKET_LABELS[m.market] || m.market.replace(/_/g, ' ').toUpperCase()}</span>
                    <span className="text-slate-500 text-xs ml-2">({m.total} picks)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${m.winRate}%` }}
                      />
                    </div>
                    <span className="text-emerald-400 font-semibold text-sm w-12 text-right">{m.winRate}%</span>
                    <span className={`text-xs font-medium w-16 text-right ${m.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {m.profit >= 0 ? '+' : ''}£{m.profit.toFixed(0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* By Tier */}
        {categoryStats.filter(c => c.total > 0).length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">By Tier</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categoryStats.filter(c => c.total > 0).map(cat => {
                const cfg = tierConfig[cat.category] || {};
                const Icon = cfg.icon || Target;
                const winRate = cat.total > 0 ? (cat.wins / cat.total * 100).toFixed(1) : 0;
                return (
                  <div key={cat.category} className={`bg-gradient-to-br ${cfg.bg || ''} rounded-2xl border ${cfg.border || 'border-slate-700/50'} p-5`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="w-5 h-5" style={{ color: cfg.color }} />
                      <span className="text-white font-semibold capitalize">{cfg.label || cat.category}</span>
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{winRate}%</div>
                    <div className="text-slate-400 text-sm">{cat.wins}W / {cat.losses}L ({cat.total} picks)</div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* By Tour */}
        {tourStats.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">By Tour</h2>
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left px-5 py-3 text-sm font-medium text-slate-400">Tour</th>
                    <th className="text-center px-5 py-3 text-sm font-medium text-slate-400">Picks</th>
                    <th className="text-center px-5 py-3 text-sm font-medium text-emerald-400">Wins</th>
                    <th className="text-center px-5 py-3 text-sm font-medium text-red-400">Losses</th>
                    <th className="text-center px-5 py-3 text-sm font-medium text-slate-400">Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {tourStats.map((tour, idx) => {
                    const winRate = tour.total > 0 ? (tour.wins / tour.total * 100).toFixed(1) : 0;
                    return (
                      <tr key={tour.tour} className={idx !== tourStats.length - 1 ? 'border-b border-slate-700/30' : ''}>
                        <td className="px-5 py-4 font-medium text-white">{tour.tour}</td>
                        <td className="px-5 py-4 text-center text-slate-300 font-semibold">{tour.total}</td>
                        <td className="px-5 py-4 text-center text-emerald-400 font-semibold">{tour.wins}</td>
                        <td className="px-5 py-4 text-center text-red-400 font-semibold">{tour.losses}</td>
                        <td className="px-5 py-4 text-center">
                          <Badge className={`${parseFloat(winRate) >= 50 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                            {winRate}%
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Footer note */}
        <div className="text-center text-slate-500 text-xs mt-10">
          <p>All P&L calculations assume a flat £{STAKE} stake per bet. Past performance does not guarantee future results.</p>
          <p className="mt-1">Please gamble responsibly. <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">BeGambleAware.org</a></p>
        </div>
      </div>
    </>
  );
}
