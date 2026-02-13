import { useState, useMemo, useEffect } from 'react';
import { api } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  XCircle,
  PoundSterling,
  Crown,
  ArrowRight,
  Check,
  BookOpen
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ResultsSkeleton from '@/components/ui/skeletons/ResultsSkeleton';
import SEOHead from '@/components/SEOHead';
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
  const [selectedWeek, setSelectedWeek] = useState(null); // null = auto-select latest
  const [initialised, setInitialised] = useState(false);
  const navigate = useNavigate();

  // First fetch with 'all' to get availableWeeks, then auto-select latest week
  const queryWeek = selectedWeek || 'all';
  const { data: resultsData, isLoading, error } = useQuery({
    queryKey: ['historicalPicks', queryWeek],
    queryFn: () => api.getSettledResults(queryWeek),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const { data: recap } = useQuery({
    queryKey: ['weeklyRecap'],
    queryFn: () => api.getWeeklyRecap(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['membershipPackages'],
    queryFn: () => api.membershipPackages.list(),
    retry: false
  });

  const { data: ctaContent } = useQuery({
    queryKey: ['siteContent', 'results-cta'],
    queryFn: () => api.siteContent.get('results-cta'),
    retry: false
  });

  const availableWeeks = resultsData?.availableWeeks || [];

  // Auto-select the most recent week on first load
  useEffect(() => {
    if (!initialised && availableWeeks.length > 0) {
      setSelectedWeek(availableWeeks[availableWeeks.length - 1]);
      setInitialised(true);
    }
  }, [availableWeeks, initialised]);

  const picks = resultsData?.data || [];
  const stats = resultsData?.stats || {};
  const categoryStats = resultsData?.categoryStats || [];
  const tourStats = resultsData?.tourStats || [];

  const ctaTitle = ctaContent?.json?.title || 'Get Our Best Picks Every Week';
  const ctaSubtitle = ctaContent?.json?.subtitle || 'Join BetCaddies and unlock expert golf betting picks, detailed analysis, and weekly insights delivered straight to you.';

  const { winningPicks, losingPicks, pendingPicks } = useMemo(() => {
    const wins = picks.filter(p => p.outcome === 'won').sort((a, b) => (b.odds_decimal_best || 0) - (a.odds_decimal_best || 0));
    const losses = picks.filter(p => p.outcome === 'lost').sort((a, b) => (b.odds_decimal_best || 0) - (a.odds_decimal_best || 0));
    const pending = picks.filter(p => !p.outcome || p.outcome === 'pending');
    return { winningPicks: wins, losingPicks: losses, pendingPicks: pending };
  }, [picks]);

  const levelLabels = { free: 'Free', pro: 'Pro', elite: 'Elite' };

  return (
    <>
      <SEOHead title="Results — Historical Picks" description="Transparent track record of all BetCaddies golf betting picks. Win rates, P&L, and detailed results by category and tour." path="/Results" />
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
        <Select value={queryWeek} onValueChange={(val) => { setSelectedWeek(val); setInitialised(true); }}>
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
        <ResultsSkeleton />
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
          {/* Financial Stats Hero */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-emerald-900/50 to-emerald-800/20 rounded-2xl border border-emerald-500/30 p-5 text-center">
                <div className="text-4xl font-bold text-emerald-400">{stats.wins || 0}</div>
                <div className="text-emerald-300 font-medium mt-1 flex items-center justify-center gap-1 text-sm">
                  <Trophy className="w-4 h-4" />
                  Total Winners
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/20 rounded-2xl border border-blue-500/30 p-5 text-center">
                <div className="text-4xl font-bold text-blue-400">{stats.lastWeekWins || 0}</div>
                <div className="text-blue-300 font-medium mt-1 flex items-center justify-center gap-1 text-sm">
                  <Calendar className="w-4 h-4" />
                  Wins Last Week
                </div>
              </div>

              <div className="bg-gradient-to-br from-amber-900/50 to-amber-800/20 rounded-2xl border border-amber-500/30 p-5 text-center">
                <div className="text-4xl font-bold text-amber-400">
                  {(stats.lastWeekWinnings || 0) >= 0 ? '+' : ''}£{Math.abs(stats.lastWeekWinnings || 0).toFixed(2)}
                </div>
                <div className="text-amber-300 font-medium mt-1 flex items-center justify-center gap-1 text-sm">
                  <PoundSterling className="w-4 h-4" />
                  Last Week P&L
                </div>
              </div>

              <div className="bg-gradient-to-br from-violet-900/50 to-violet-800/20 rounded-2xl border border-violet-500/30 p-5 text-center">
                <div className={`text-4xl font-bold ${(stats.runningTotal || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(stats.runningTotal || 0) >= 0 ? '+' : ''}£{Math.abs(stats.runningTotal || 0).toFixed(2)}
                </div>
                <div className="text-violet-300 font-medium mt-1 flex items-center justify-center gap-1 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  Running Total
                </div>
              </div>
            </div>

            <p className="text-slate-500 text-xs text-center mt-3">
              All figures based on a flat £{stats.stake || 10} stake per bet. Win Rate: {stats.winRate || 0}% across {stats.total || 0} picks.
            </p>
          </motion.div>

          {/* Weekly Recap */}
          {recap?.recapText && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-10"
            >
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                <h2 className="text-xl font-bold text-white">Weekly Recap</h2>
                {recap.weekKey && (
                  <Badge variant="outline" className="text-xs border-slate-600 text-slate-400 ml-2">
                    {recap.weekKey.replace('weekly_', '').replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-6">
                {recap.recapText.split('\n\n').map((paragraph, idx) => (
                  <p key={idx} className="text-slate-300 leading-relaxed mb-4 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
            </motion.div>
          )}

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
                          <div className="text-emerald-300 text-xs mt-0.5">
                            +£{((bet.odds_decimal_best || 2) * 10 - 10).toFixed(2)}
                          </div>
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

          {/* PENDING PICKS */}
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

      {/* CTA Section + Membership Packages */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-16"
      >
        {/* CTA Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-600/20 border border-amber-500/30 mb-4">
            <Crown className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">{ctaTitle}</h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">{ctaSubtitle}</p>
        </div>

        {/* Membership Packages Grid */}
        {packages.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {packages.filter(pkg => pkg.enabled !== false).map((pkg, idx) => {
              const isPopular = pkg.popular || pkg.badges?.some(b => String(b?.text || '').toLowerCase().includes('popular'));

              return (
                <motion.div
                  key={pkg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + idx * 0.1 }}
                  className={`bg-slate-800/50 backdrop-blur-sm rounded-2xl border p-8 relative ${
                    isPopular
                      ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/20'
                      : 'border-slate-700/50'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-emerald-500 text-white border-emerald-400 px-3 py-1">
                        <Zap className="w-3 h-3 mr-1" /> Most Popular
                      </Badge>
                    </div>
                  )}

                  {pkg.access_level && pkg.access_level !== 'free' && (
                    <Badge className={`mb-3 ${
                      pkg.access_level === 'elite'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    }`}>
                      {levelLabels[pkg.access_level] || pkg.access_level} Access
                    </Badge>
                  )}

                  <h3 className="text-2xl font-bold text-white mb-2">{pkg.name}</h3>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white">£{pkg.price}</span>
                      <span className="text-slate-400">/{pkg.billing_period}</span>
                    </div>
                    {pkg.trial_days > 0 && (
                      <p className="text-emerald-400 text-sm mt-1">
                        {pkg.trial_days}-day free trial included
                      </p>
                    )}
                  </div>

                  {pkg.description && (
                    <p className="text-slate-400 mb-6 text-sm">{pkg.description}</p>
                  )}

                  {pkg.features && pkg.features.length > 0 && (
                    <div className="space-y-2 mb-6">
                      {pkg.features.slice(0, 4).map((feature, fidx) => (
                        <div key={fidx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span className="text-slate-300 text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    onClick={() => navigate('/Memberships')}
                    className={`w-full ${
                      isPopular
                        ? 'bg-emerald-500 hover:bg-emerald-600'
                        : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center text-slate-500 text-sm">
          <p>All prices in GBP. Cancel anytime. No hidden fees.</p>
        </div>
      </motion.div>
    </div>
    </>
  );
}
