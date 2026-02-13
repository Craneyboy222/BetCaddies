import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { motion } from 'framer-motion';
import {
  User, Flag, Trophy, TrendingUp, TrendingDown, Minus,
  Target, MapPin, BarChart3, ChevronRight, ArrowLeft,
  Crosshair, Circle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const tierColors = {
  PAR: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  BIRDIE: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
  EAGLE: 'bg-violet-500/20 text-violet-400 border-violet-500/50',
  LONG_SHOTS: 'bg-rose-500/20 text-rose-400 border-rose-500/50',
};

function SGBar({ label, value, icon: Icon }) {
  if (value == null) return null;
  const pct = Math.max(0, Math.min(100, ((value + 2) / 4) * 100));
  const color = value >= 1.0 ? 'bg-emerald-500' : value >= 0.3 ? 'bg-teal-500' : value >= 0 ? 'bg-slate-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400 flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </span>
        <span className={`font-mono font-medium ${value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {value >= 0 ? '+' : ''}{value.toFixed(2)}
        </span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function PlayerPage() {
  const { slug } = useParams();

  const { data: player, isLoading, error } = useQuery({
    queryKey: ['player', slug],
    queryFn: () => api.players.get(slug),
    retry: false,
  });

  if (isLoading) return <LoadingSpinner text="Loading player..." />;

  if (error || !player) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Player Not Found</h1>
        <p className="text-slate-400 mb-6">We couldn't find this player in our database.</p>
        <Link to="/" className="text-emerald-400 hover:underline">Back to Home</Link>
      </div>
    );
  }

  const formIndicatorIcon = player.form?.formIndicator === 'up'
    ? <TrendingUp className="w-4 h-4 text-emerald-400" />
    : player.form?.formIndicator === 'down'
    ? <TrendingDown className="w-4 h-4 text-red-400" />
    : <Minus className="w-4 h-4 text-slate-400" />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start gap-5 mb-8"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
          <span className="text-3xl font-bold text-white">
            {player.name?.[0] || '?'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-white">{player.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {player.country && (
              <span className="flex items-center gap-1 text-sm text-slate-400">
                <Flag className="w-3.5 h-3.5" />
                {player.country}
              </span>
            )}
            {player.tours?.length > 0 && player.tours.map(t => (
              <Badge key={t} variant="outline" className="border-slate-700 text-slate-300 text-xs">
                {t}
              </Badge>
            ))}
            {player.form?.dgRank && (
              <span className="text-sm text-slate-400">
                DG Rank: <span className="text-white font-medium">#{player.form.dgRank}</span>
              </span>
            )}
            {player.form?.owgrRank && (
              <span className="text-sm text-slate-400">
                OWGR: <span className="text-white font-medium">#{player.form.owgrRank}</span>
              </span>
            )}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Stats */}
        <div className="lg:col-span-2 space-y-6">
          {/* Form & Strokes Gained */}
          {player.form && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-5"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-400" />
                  Current Form
                </h2>
                <div className="flex items-center gap-2">
                  {formIndicatorIcon}
                  <Badge
                    className={`${
                      player.form.formScore >= 70 ? 'bg-emerald-500/20 text-emerald-400'
                      : player.form.formScore >= 40 ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {player.form.formLabel}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <SGBar label="Total" value={player.form.sgTotal} icon={BarChart3} />
                <SGBar label="Off the Tee" value={player.form.sgOtt} icon={Target} />
                <SGBar label="Approach" value={player.form.sgApp} icon={Crosshair} />
                <SGBar label="Around Green" value={player.form.sgArg} icon={Circle} />
                <SGBar label="Putting" value={player.form.sgPutt} icon={Circle} />
              </div>
            </motion.div>
          )}

          {/* Course Fit (latest event) */}
          {player.courseFit?.components && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-5"
            >
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-emerald-400" />
                Course Fit (Latest Event)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'History', value: player.courseFit.components.history },
                  { label: 'Distance', value: player.courseFit.components.distance },
                  { label: 'Accuracy', value: player.courseFit.components.accuracy },
                  { label: 'Experience', value: player.courseFit.components.experience },
                  { label: 'SG Category', value: player.courseFit.components.sgCategory },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-800/50 rounded-xl p-3 text-center">
                    <div className="text-xs text-slate-400 mb-1">{label}</div>
                    <div className={`text-lg font-bold ${value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-slate-300'}`}>
                      {value != null ? `${value >= 0 ? '+' : ''}${value.toFixed(3)}` : '—'}
                    </div>
                  </div>
                ))}
                <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-400 mb-1">Overall Fit</div>
                  <div className="text-lg font-bold text-white">{player.courseFit.courseFitScore ?? '—'}/100</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Recent Tournaments */}
          {player.recentTournaments?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-5"
            >
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-emerald-400" />
                Recent Tournaments
              </h2>
              <div className="space-y-2">
                {player.recentTournaments.slice(0, 15).map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs shrink-0">
                        {t.tour}
                      </Badge>
                      <div className="min-w-0">
                        <div className="text-sm text-white truncate">{t.event}</div>
                        {t.course && (
                          <Link
                            to={`/course/${t.course.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`}
                            className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
                          >
                            {t.course}
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 shrink-0 ml-2">
                      {t.startDate ? new Date(t.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column — Pick History */}
        <div className="space-y-6">
          {/* Pick History Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-5"
          >
            <h2 className="text-lg font-semibold text-white mb-4">BetCaddies Picks</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-white">{player.totalPicks ?? 0}</div>
                <div className="text-xs text-slate-400">Total Picks</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-emerald-400">{player.totalWins ?? 0}</div>
                <div className="text-xs text-slate-400">Positive Edge</div>
              </div>
            </div>
          </motion.div>

          {/* Pick History List */}
          {player.pickHistory?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-5"
            >
              <h2 className="text-sm font-semibold text-white mb-3">Pick History</h2>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {player.pickHistory.map((pick) => (
                  <div key={pick.id} className="bg-slate-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <Badge className={`text-xs ${tierColors[pick.tier] || 'bg-slate-700 text-slate-300'}`}>
                        {pick.tier}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {pick.date ? new Date(pick.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                      </span>
                    </div>
                    <div className="text-sm text-white truncate">{pick.event}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span>{pick.marketKey}</span>
                      <span className="text-emerald-400 font-medium">{pick.bestOdds?.toFixed(2)}</span>
                      {pick.edge != null && (
                        <span className={pick.edge > 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {(pick.edge * 100).toFixed(1)}% edge
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
