import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { motion } from 'framer-motion';
import {
  MapPin, Ruler, Flag, Trophy, Target, Cloud,
  ArrowLeft, BarChart3, ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const tierColors = {
  PAR: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  BIRDIE: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
  EAGLE: 'bg-violet-500/20 text-violet-400 border-violet-500/50',
  LONG_SHOTS: 'bg-rose-500/20 text-rose-400 border-rose-500/50',
};

function nameToSlug(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function CoursePage() {
  const { slug } = useParams();

  const { data: course, isLoading, error } = useQuery({
    queryKey: ['course', slug],
    queryFn: () => api.courses.get(slug),
    retry: false,
  });

  if (isLoading) return <LoadingSpinner text="Loading course..." />;

  if (error || !course) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Course Not Found</h1>
        <p className="text-slate-400 mb-6">We couldn't find this course in our database.</p>
        <Link to="/" className="text-emerald-400 hover:underline">Back to Home</Link>
      </div>
    );
  }

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
        className="mb-8"
      >
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-white">{course.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {course.par && (
                <span className="flex items-center gap-1 text-sm text-slate-400">
                  <Flag className="w-3.5 h-3.5" />
                  Par {course.par}
                </span>
              )}
              {course.yardage && (
                <span className="flex items-center gap-1 text-sm text-slate-400">
                  <Ruler className="w-3.5 h-3.5" />
                  {course.yardage.toLocaleString()} yards
                </span>
              )}
              {course.typeTags?.length > 0 && course.typeTags.map(tag => (
                <Badge key={tag} variant="outline" className="border-slate-700 text-slate-300 text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
            {course.notes && (
              <p className="text-sm text-slate-400 mt-2">{course.notes}</p>
            )}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Scoring Stats */}
          {course.scoringStats?.avgScore && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-5"
            >
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                Scoring Profile
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-white">
                    {course.scoringStats.avgScore.toFixed(1)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Avg Score</div>
                </div>
                {course.scoringStats.scoringRange && (
                  <>
                    <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-emerald-400">
                        {course.scoringStats.scoringRange.low}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">Low Round</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-red-400">
                        {course.scoringStats.scoringRange.high}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">High Round</div>
                    </div>
                  </>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-3">
                Based on {course.scoringStats.roundsAnalyzed} rounds analyzed
              </div>
            </motion.div>
          )}

          {/* Tournament History */}
          {course.events?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-5"
            >
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-emerald-400" />
                Tournament History
              </h2>
              <div className="space-y-4">
                {course.events.map((event) => (
                  <div key={event.id} className="bg-slate-800/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-white font-medium">{event.eventName}</div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">
                            {event.tour}
                          </Badge>
                          <span>
                            {event.startDate ? new Date(event.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                          </span>
                          {event.location && <span>{event.location}</span>}
                        </div>
                      </div>
                      {event.picks?.length > 0 && (
                        <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
                          {event.picks.length} picks
                        </Badge>
                      )}
                    </div>

                    {/* Picks for this event */}
                    {event.picks?.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {event.picks.slice(0, 8).map((pick) => (
                          <div key={pick.id} className="flex items-center justify-between py-1.5 border-t border-slate-700/50">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge className={`text-xs shrink-0 ${tierColors[pick.tier] || ''}`}>
                                {pick.tier}
                              </Badge>
                              <Link
                                to={`/player/${nameToSlug(pick.selection)}`}
                                className="text-sm text-white hover:text-emerald-400 transition-colors truncate"
                              >
                                {pick.selection}
                              </Link>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0 ml-2">
                              <span className="text-emerald-400 font-medium">{pick.bestOdds?.toFixed(2)}</span>
                              {pick.edge != null && (
                                <span className={pick.edge > 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  {(pick.edge * 100).toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column — Sidebar */}
        <div className="space-y-6">
          {/* Course Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-5"
          >
            <h2 className="text-sm font-semibold text-white mb-3">Course Info</h2>
            <div className="space-y-3">
              {course.par && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Par</span>
                  <span className="text-white font-medium">{course.par}</span>
                </div>
              )}
              {course.yardage && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Yardage</span>
                  <span className="text-white font-medium">{course.yardage.toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Events Tracked</span>
                <span className="text-white font-medium">{course.totalEvents ?? 0}</span>
              </div>
              {course.typeTags?.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Type</span>
                  <span className="text-white font-medium">{course.typeTags.join(', ')}</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Weather */}
          {course.weather?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-5"
            >
              <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                <Cloud className="w-4 h-4 text-slate-400" />
                Recent Weather
              </h2>
              <div className="text-sm text-slate-400">
                Latest forecast from {course.weather[0].provider}
                <div className="text-xs text-slate-500 mt-1">
                  Updated {new Date(course.weather[0].fetchedAt).toLocaleDateString('en-GB')}
                </div>
              </div>
            </motion.div>
          )}

          {/* Course Type Tags */}
          {course.typeTags?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-5"
            >
              <h2 className="text-sm font-semibold text-white mb-3">Course Characteristics</h2>
              <div className="flex flex-wrap gap-2">
                {course.typeTags.map(tag => (
                  <Badge key={tag} className="bg-slate-800/50 text-slate-300 border border-slate-700">
                    {tag}
                  </Badge>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
