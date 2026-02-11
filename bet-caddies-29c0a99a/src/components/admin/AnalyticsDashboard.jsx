import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Users,
  CreditCard,
  TrendingUp,
  Target,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Trophy,
  Zap,
  Award,
  PoundSterling,
  MousePointerClick,
  UserPlus,
  ShoppingCart,
  CheckCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const StatCard = ({ label, value, icon: Icon, color = 'text-white', subtext, trend }) => (
  <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-5">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <div className="text-2xl font-bold text-white">{value}</div>
    <div className="text-xs text-slate-400 mt-1">{label}</div>
    {subtext && <div className="text-[10px] text-slate-500 mt-0.5">{subtext}</div>}
  </div>
);

const FunnelStep = ({ label, count7d, count30d, icon: Icon, color, conversionRate }) => (
  <div className="flex items-center gap-4 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30">
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-white">{label}</div>
      <div className="text-xs text-slate-500">
        {count7d} last 7d &middot; {count30d} last 30d
      </div>
    </div>
    {conversionRate !== undefined && conversionRate !== null && (
      <Badge className="bg-slate-700/60 text-slate-300 border-slate-600 text-xs">
        {conversionRate}%
      </Badge>
    )}
  </div>
);

const tierColors = {
  PAR: 'text-emerald-400',
  BIRDIE: 'text-amber-400',
  EAGLE: 'text-violet-400',
  LONG_SHOTS: 'text-rose-400'
};

const tierIcons = {
  PAR: Target,
  BIRDIE: Zap,
  EAGLE: Trophy,
  LONG_SHOTS: Award
};

export default function AnalyticsDashboard() {
  const [timePeriod, setTimePeriod] = useState('30');

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['adminAnalyticsOverview'],
    queryFn: async () => {
      const res = await api.client.get('/api/admin/analytics/overview');
      return res.data || res;
    },
    refetchInterval: 60_000,
  });

  const { data: conversions, isLoading: conversionsLoading } = useQuery({
    queryKey: ['adminAnalyticsConversions'],
    queryFn: async () => {
      const res = await api.client.get('/api/admin/analytics/conversions');
      return res.data || res;
    },
    refetchInterval: 60_000,
  });

  const { data: popularBets, isLoading: popularBetsLoading } = useQuery({
    queryKey: ['adminAnalyticsPopularBets'],
    queryFn: async () => {
      const res = await api.client.get('/api/admin/analytics/popular-bets');
      return res.data || res;
    },
    refetchInterval: 5 * 60_000,
  });

  const { data: betPerformance, isLoading: betPerfLoading } = useQuery({
    queryKey: ['adminAnalyticsBetPerformance'],
    queryFn: async () => {
      const res = await api.client.get('/api/admin/analytics/bet-performance');
      return res.data || res;
    },
    refetchInterval: 5 * 60_000,
  });

  const { data: eventCounts } = useQuery({
    queryKey: ['adminAnalyticsEvents', timePeriod],
    queryFn: async () => {
      const res = await api.client.get(`/api/admin/analytics/events?days=${timePeriod}`);
      return res.data || res;
    },
    refetchInterval: 60_000,
  });

  if (overviewLoading) return <LoadingSpinner text="Loading analytics..." />;

  const o = overview || {};
  const c = conversions || {};
  const bp = betPerformance || {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
          <p className="text-sm text-slate-400 mt-1">Platform performance and user insights</p>
        </div>
        <Select value={timePeriod} onValueChange={setTimePeriod}>
          <SelectTrigger className="w-36 bg-slate-800 border-slate-700">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={o.totalUsers ?? 0}
          icon={Users}
          color="text-blue-400"
          subtext={`+${o.signupsLast7Days ?? 0} this week`}
        />
        <StatCard
          label="Active Subscriptions"
          value={o.activeSubscriptions ?? 0}
          icon={CreditCard}
          color="text-emerald-400"
        />
        <StatCard
          label="MRR"
          value={`£${(o.mrr ?? 0).toFixed(2)}`}
          icon={PoundSterling}
          color="text-amber-400"
          subtext={`ARR: £${((o.mrr ?? 0) * 12).toFixed(0)}`}
        />
        <StatCard
          label="Total Bets Published"
          value={o.totalBets ?? 0}
          icon={Target}
          color="text-violet-400"
          subtext={`${o.totalPageViews ?? 0} page views`}
        />
      </div>

      {/* Signups */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Signups (7d)"
          value={o.signupsLast7Days ?? 0}
          icon={UserPlus}
          color="text-teal-400"
        />
        <StatCard
          label="Signups (30d)"
          value={o.signupsLast30Days ?? 0}
          icon={UserPlus}
          color="text-teal-400"
        />
        <StatCard
          label="Page Views (7d)"
          value={c.pageViews?.last7Days ?? 0}
          icon={Eye}
          color="text-sky-400"
        />
        <StatCard
          label="Checkout Starts (30d)"
          value={c.checkoutStarts?.last30Days ?? 0}
          icon={ShoppingCart}
          color="text-orange-400"
        />
      </div>

      {/* Conversion Funnel */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Conversion Funnel</h3>
        <div className="space-y-2">
          <FunnelStep
            label="Page Views"
            count7d={c.pageViews?.last7Days ?? 0}
            count30d={c.pageViews?.last30Days ?? 0}
            icon={Eye}
            color="bg-sky-500/20 text-sky-400"
          />
          <FunnelStep
            label="Signups"
            count7d={c.signups?.last7Days ?? 0}
            count30d={c.signups?.last30Days ?? 0}
            icon={UserPlus}
            color="bg-teal-500/20 text-teal-400"
            conversionRate={c.pageViews?.last30Days > 0 ? ((c.signups?.last30Days || 0) / c.pageViews.last30Days * 100).toFixed(1) : null}
          />
          <FunnelStep
            label="Checkout Started"
            count7d={c.checkoutStarts?.last7Days ?? 0}
            count30d={c.checkoutStarts?.last30Days ?? 0}
            icon={ShoppingCart}
            color="bg-orange-500/20 text-orange-400"
            conversionRate={c.signups?.last30Days > 0 ? ((c.checkoutStarts?.last30Days || 0) / c.signups.last30Days * 100).toFixed(1) : null}
          />
          <FunnelStep
            label="Checkout Completed"
            count7d={c.checkoutCompletes?.last7Days ?? 0}
            count30d={c.checkoutCompletes?.last30Days ?? 0}
            icon={CheckCircle}
            color="bg-emerald-500/20 text-emerald-400"
            conversionRate={c.checkoutStarts?.last30Days > 0 ? ((c.checkoutCompletes?.last30Days || 0) / c.checkoutStarts.last30Days * 100).toFixed(1) : null}
          />
        </div>
      </div>

      {/* Two column: Popular Bets + Bet Performance */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Most Popular Bets (by Track Bet clicks) */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Most Tracked Bets</h3>
          {popularBetsLoading ? (
            <LoadingSpinner />
          ) : (popularBets?.topBets || []).length === 0 ? (
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 text-center text-slate-500 text-sm">
              No tracked bet data yet. Data populates when users click "Track Bet".
            </div>
          ) : (
            <div className="space-y-2">
              {(popularBets?.topBets || []).slice(0, 10).map((bet, idx) => (
                <div key={bet.betId || idx} className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30">
                  <div className="w-7 h-7 rounded-full bg-slate-700/50 flex items-center justify-center text-xs font-bold text-slate-300">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{bet.selectionName || bet.betId}</div>
                    <div className="text-xs text-slate-500">{bet.marketKey} &middot; {bet.tier}</div>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    <MousePointerClick className="w-3 h-3 mr-1" />
                    {bet.trackCount}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Tier Breakdown */}
          {popularBets?.tierBreakdown && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-slate-400 mb-2">Tracks by Tier</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(popularBets.tierBreakdown).map(([tier, count]) => {
                  const Icon = tierIcons[tier] || Target;
                  return (
                    <div key={tier} className="flex items-center gap-2 p-2 bg-slate-800/20 rounded-lg">
                      <Icon className={`w-4 h-4 ${tierColors[tier] || 'text-slate-400'}`} />
                      <span className="text-xs text-slate-300 flex-1">{tier}</span>
                      <span className="text-xs font-bold text-white">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bet Performance by Tier */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Bet Performance</h3>
          {betPerfLoading ? (
            <LoadingSpinner />
          ) : (bp.byTier || []).length === 0 ? (
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 text-center text-slate-500 text-sm">
              No bet performance data yet.
            </div>
          ) : (
            <div className="space-y-3">
              {(bp.byTier || []).map(tier => {
                const Icon = tierIcons[tier.tier] || Target;
                const roi = tier.totalBets > 0
                  ? ((tier.totalProfit / (tier.totalBets * 10)) * 100).toFixed(1)
                  : 0;
                return (
                  <div key={tier.tier} className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={`w-5 h-5 ${tierColors[tier.tier] || 'text-slate-400'}`} />
                      <span className="font-semibold text-white">{tier.tier}</span>
                      <Badge className="ml-auto bg-slate-700/50 text-slate-300 border-slate-600 text-xs">
                        {tier.totalBets} bets
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div>
                        <div className="text-lg font-bold text-emerald-400">{tier.wins}</div>
                        <div className="text-[10px] text-slate-500">Wins</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-red-400">{tier.losses}</div>
                        <div className="text-[10px] text-slate-500">Losses</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-amber-400">{tier.winRate}%</div>
                        <div className="text-[10px] text-slate-500">Win Rate</div>
                      </div>
                      <div>
                        <div className={`text-lg font-bold ${parseFloat(roi) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {roi}%
                        </div>
                        <div className="text-[10px] text-slate-500">ROI</div>
                      </div>
                    </div>
                    {tier.avgPredictedProb !== undefined && tier.avgActualWinRate !== undefined && (
                      <div className="mt-2 pt-2 border-t border-slate-700/30 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Predicted: {(tier.avgPredictedProb * 100).toFixed(1)}%</span>
                        <span className="text-slate-500">Actual: {(tier.avgActualWinRate * 100).toFixed(1)}%</span>
                        <span className={`font-medium ${Math.abs(tier.avgPredictedProb - tier.avgActualWinRate) < 0.05 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {Math.abs(tier.avgPredictedProb - tier.avgActualWinRate) < 0.05 ? 'Well calibrated' : 'Needs calibration'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Overall */}
              {bp.overall && (
                <div className="p-4 bg-gradient-to-r from-emerald-900/30 to-slate-800/30 rounded-xl border border-emerald-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <span className="font-semibold text-white">Overall</span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div>
                      <div className="text-lg font-bold text-white">{bp.overall.totalBets}</div>
                      <div className="text-[10px] text-slate-500">Total</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-emerald-400">{bp.overall.winRate}%</div>
                      <div className="text-[10px] text-slate-500">Win Rate</div>
                    </div>
                    <div>
                      <div className={`text-lg font-bold ${bp.overall.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        £{Math.abs(bp.overall.totalProfit).toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-500">P&L (£10/bet)</div>
                    </div>
                    <div>
                      <div className={`text-lg font-bold ${bp.overall.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {bp.overall.roi}%
                      </div>
                      <div className="text-[10px] text-slate-500">ROI</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Performance by Market */}
          {(bp.byMarket || []).length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-slate-400 mb-2">By Market Type</h4>
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left px-3 py-2 text-slate-500">Market</th>
                      <th className="text-center px-2 py-2 text-slate-500">Bets</th>
                      <th className="text-center px-2 py-2 text-emerald-500">Wins</th>
                      <th className="text-center px-2 py-2 text-slate-500">Win %</th>
                      <th className="text-right px-3 py-2 text-slate-500">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bp.byMarket.map(m => (
                      <tr key={m.market} className="border-b border-slate-700/20">
                        <td className="px-3 py-2 text-white font-medium">{m.market.toUpperCase()}</td>
                        <td className="px-2 py-2 text-center text-slate-300">{m.totalBets}</td>
                        <td className="px-2 py-2 text-center text-emerald-400">{m.wins}</td>
                        <td className="px-2 py-2 text-center text-slate-300">{m.winRate}%</td>
                        <td className={`px-3 py-2 text-right font-medium ${parseFloat(m.roi) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {m.roi}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Daily Event Counts */}
      {eventCounts?.daily && eventCounts.daily.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Daily Activity (Last {timePeriod} days)</h3>
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left px-4 py-2 text-slate-500">Date</th>
                  <th className="text-center px-3 py-2 text-slate-500">Page Views</th>
                  <th className="text-center px-3 py-2 text-slate-500">Track Bet</th>
                  <th className="text-center px-3 py-2 text-slate-500">Signups</th>
                  <th className="text-center px-3 py-2 text-slate-500">Checkouts</th>
                </tr>
              </thead>
              <tbody>
                {eventCounts.daily.slice(0, 14).map(day => (
                  <tr key={day.date} className="border-b border-slate-700/20">
                    <td className="px-4 py-2 text-white">{day.date}</td>
                    <td className="px-3 py-2 text-center text-slate-300">{day.page_view || 0}</td>
                    <td className="px-3 py-2 text-center text-slate-300">{day.track_bet || 0}</td>
                    <td className="px-3 py-2 text-center text-slate-300">{day.signup || 0}</td>
                    <td className="px-3 py-2 text-center text-slate-300">{day.checkout_complete || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
