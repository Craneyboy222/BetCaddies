import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { List, Plus, Trash2, ExternalLink, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/ui/EmptyState';
import { useTrackedBets } from '@/hooks/useTrackedBets';
import SEOHead from '@/components/SEOHead';

const marketColors = {
  'Outright Winner': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Top 5': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'Top 10': 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  'Top 20': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Make Cut': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'First Round Leader': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'Tournament Matchup': 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  'Round Matchup': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'Three-Ball': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
};

export default function MyBets() {
  const { trackedBets, toggleTrack, clearAll } = useTrackedBets();

  return (
    <>
      <SEOHead title="My Bets" description="Your personal bet tracker. View and manage your saved golf betting selections." path="/MyBets" />
      <div className="max-w-5xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
              <List className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">My Bets</h1>
              <p className="text-slate-400">Track your selections ({trackedBets.length} tracked)</p>
            </div>
          </div>
          {trackedBets.length > 0 && (
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-400 hover:text-red-400 hover:border-red-500/30" onClick={clearAll}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
      </motion.div>

      {trackedBets.length === 0 ? (
        <EmptyState
          icon={List}
          title="No Tracked Bets"
          description="Hit 'Track Bet' on any pick to add it here."
          action={
            <Link to={createPageUrl('Home')}>
              <Button className="bg-emerald-500 hover:bg-emerald-600">
                <Plus className="w-4 h-4 mr-2" />
                Browse Picks
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {trackedBets.map((bet) => {
            const mColor = marketColors[bet.market_label] || 'bg-slate-500/20 text-slate-300 border-slate-500/30';
            return (
              <motion.div
                key={bet.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 flex items-center gap-4"
              >
                {/* Left: market badge + player info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className={`${mColor} text-xs font-semibold`}>
                      {bet.market_label || 'Market'}
                    </Badge>
                    <span className="text-xs text-slate-500">{bet.tour}</span>
                  </div>
                  <div className="text-white font-semibold truncate">{bet.selection_name}</div>
                  {bet.is_matchup && bet.matchup_opponent && (
                    <div className="text-xs text-slate-500">vs {bet.matchup_opponent}</div>
                  )}
                  <div className="text-xs text-slate-500 mt-1">{bet.tournament_name}</div>
                </div>

                {/* Middle: odds + edge */}
                <div className="text-right shrink-0">
                  <div className="text-xl font-bold text-emerald-400">{bet.odds_display_best}</div>
                  {bet.edge_pct != null && (
                    <div className={`text-xs ${bet.edge_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {bet.edge_pct > 0 ? '+' : ''}{bet.edge_pct.toFixed(1)}% edge
                    </div>
                  )}
                </div>

                {/* Right: remove */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-500 hover:text-red-400 shrink-0"
                  onClick={() => toggleTrack(bet)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}
