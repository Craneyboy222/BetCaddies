import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Zap, TrendingUp, TrendingDown, Minus, Cloud, Sun, Wind, Droplets, Plus, ExternalLink, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const tourColors = {
  PGA: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  DPWT: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  DP_WORLD: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  KFT: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  LIV: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  LPGA: 'bg-pink-500/20 text-pink-400 border-pink-500/30'
};

const categoryColors = {
  par: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
  birdie: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
  eagle: 'from-violet-500/20 to-violet-600/10 border-violet-500/30'
};

const weatherIcons = {
  sunny: Sun,
  cloudy: Cloud,
  windy: Wind,
  rainy: Droplets
};

const CaddyIcon = ({ filled }) => (
  <svg 
    viewBox="0 0 24 24" 
    className={`w-5 h-5 ${filled ? 'text-emerald-400' : 'text-slate-600'}`}
    fill="currentColor"
  >
    <circle cx="12" cy="5" r="3" />
    <path d="M12 10c-3 0-5 2-5 4v2h10v-2c0-2-2-4-5-4z" />
    <rect x="10" y="16" width="4" height="6" rx="1" />
    <line x1="6" y1="12" x2="3" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ConfidenceRating = ({ rating }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <CaddyIcon key={i} filled={i <= rating} />
    ))}
  </div>
);

const FormIndicator = ({ indicator }) => {
  if (indicator === 'up') return <TrendingUp className="w-4 h-4 text-emerald-400" />;
  if (indicator === 'down') return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
};

export default function BetCard({ bet, onAddBet, onPlaceBet, isAdded = false, providers = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [showOdds, setShowOdds] = useState(false);

  const WeatherIcon = weatherIcons[bet.weather_icon] || Cloud;
  const providerData = providers.find(p => p.slug === bet.provider_best_slug);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${categoryColors[bet.category]} backdrop-blur-xl`}
    >
      {/* Glow effect */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
      
      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
              Active
            </Badge>
            {bet.is_fallback && bet.fallback_type === 'tier_min_fill' && (
              <Badge variant="outline" className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-xs">
                Not +EV (fallback)
              </Badge>
            )}
            {bet.prob_source === 'market_fallback' && (
              <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                Fair prob fallback
              </Badge>
            )}
            <Badge variant="outline" className={`${tourColors[bet.tour]} text-xs`}>
              {bet.tour}
            </Badge>
          </div>
          <ConfidenceRating rating={bet.confidence_rating} />
        </div>

        {/* Title */}
        <p className="text-slate-400 text-sm mb-1">
          {bet.bet_title} at {bet.tour}: {bet.tournament_name}
        </p>
        
        {/* Player Name */}
        <h3 className="text-2xl font-bold text-white mb-4">
          {bet.selection_name}
        </h3>

        {/* Provider & Odds */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {providerData?.logo_url ? (
              <img src={providerData.logo_url} alt={providerData.name} className="h-8 w-auto rounded" />
            ) : (
              <div className="h-8 px-3 bg-slate-700/50 rounded flex items-center">
                <span className="text-sm text-slate-300">{bet.provider_best_slug}</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-emerald-400">
              {bet.odds_display_best}
            </div>
            <div className="text-xs text-slate-500">
              {bet.odds_decimal_best?.toFixed(2)} decimal
            </div>
          </div>
        </div>

        {/* Signals Row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {bet.is_matchup ? (
            <>
              {/* Matchup: Win Prob */}
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500 mb-1">Win Prob</div>
                <div className="flex items-center gap-1">
                  {bet.fair_prob_pct != null ? (
                    <span className={`text-lg font-semibold ${bet.fair_prob_pct >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {bet.fair_prob_pct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-lg font-semibold text-slate-400">—</span>
                  )}
                </div>
                {bet.market_prob_pct != null && (
                  <div className="text-xs text-slate-500 mt-1">Market: {bet.market_prob_pct.toFixed(1)}%</div>
                )}
              </div>

              {/* Matchup: Edge */}
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500 mb-1">Edge</div>
                <div className="flex items-center gap-1">
                  {bet.edge_pct != null ? (
                    <span className={`text-lg font-semibold ${bet.edge_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {bet.edge_pct > 0 ? '+' : ''}{bet.edge_pct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-lg font-semibold text-slate-400">—</span>
                  )}
                </div>
                {bet.ev != null && (
                  <div className="text-xs text-slate-500 mt-1">EV: {bet.ev > 0 ? '+' : ''}{(bet.ev * 100).toFixed(1)}%</div>
                )}
              </div>

              {/* Matchup: DG Rank */}
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500 mb-1">DG Rank</div>
                <div className="flex items-center gap-1">
                  {bet.dg_rank ? (
                    <span className={`text-lg font-semibold ${bet.dg_rank <= 30 ? 'text-emerald-400' : bet.dg_rank <= 75 ? 'text-white' : 'text-slate-400'}`}>
                      #{bet.dg_rank}
                    </span>
                  ) : (
                    <span className="text-lg font-semibold text-slate-400">—</span>
                  )}
                </div>
                {bet.form_label && bet.form_label !== 'Unknown' && (
                  <div className="flex items-center gap-1 mt-1">
                    <FormIndicator indicator={bet.form_indicator} />
                    <span className="text-xs text-slate-500">{bet.form_label}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Outright: Edge */}
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500 mb-1">Edge</div>
                <div className="flex items-center gap-1">
                  {bet.edge_pct != null ? (
                    <span className={`text-lg font-semibold ${bet.edge_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {bet.edge_pct > 0 ? '+' : ''}{bet.edge_pct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-lg font-semibold text-slate-400">—</span>
                  )}
                </div>
                {bet.ev != null && (
                  <div className="text-xs text-slate-500 mt-1">EV: {bet.ev > 0 ? '+' : ''}{(bet.ev * 100).toFixed(1)}%</div>
                )}
              </div>

              {/* Outright: DG Rank */}
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500 mb-1">DG Rank</div>
                <div className="flex items-center gap-1">
                  {bet.dg_rank ? (
                    <span className={`text-lg font-semibold ${bet.dg_rank <= 30 ? 'text-emerald-400' : bet.dg_rank <= 75 ? 'text-white' : 'text-slate-400'}`}>
                      #{bet.dg_rank}
                    </span>
                  ) : (
                    <span className="text-lg font-semibold text-slate-400">—</span>
                  )}
                </div>
              </div>

              {/* Outright: Form */}
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500 mb-1">Form</div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-semibold ${
                    bet.form_indicator === 'up' ? 'text-emerald-400' :
                    bet.form_indicator === 'down' ? 'text-red-400' : 'text-white'
                  }`}>
                    {bet.form_label || '—'}
                  </span>
                  <FormIndicator indicator={bet.form_indicator} />
                </div>
                {bet.sg_total != null && (
                  <div className="text-xs text-slate-500 mt-1">SG: {bet.sg_total >= 0 ? '+' : ''}{bet.sg_total.toFixed(2)}</div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Odds Movement */}
        {bet.odds_movement_summary && (
          <div className="bg-slate-800/30 rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-slate-300">{bet.odds_movement_summary}</span>
          </div>
        )}

        {/* Compare Odds */}
        <button
          onClick={() => setShowOdds(!showOdds)}
          className="w-full flex items-center justify-between py-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <span>Compare odds across {bet.books_compared || (bet.alternative_odds?.length + 1) || 1} bookmakers</span>
          {showOdds ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <AnimatePresence>
          {showOdds && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-slate-800/30 rounded-xl p-3 mb-4">
                <div className="space-y-2">
                  {bet.alternative_odds?.map((alt, idx) => {
                    const altProvider = providers.find(p => p.slug === alt.provider_slug);
                    return (
                      <div key={idx} className="flex items-center justify-between py-1">
                        <span className="text-sm text-slate-400">
                          {altProvider?.name || alt.provider_slug}
                        </span>
                        <span className="text-sm font-medium text-white">{alt.odds_display}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Analysis */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 py-3 text-left"
        >
          <Zap className="w-5 h-5 text-amber-400" />
          <span className="font-semibold text-white">AI Deep Analysis</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 ml-auto" /> : <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pb-4">
                <p className="text-slate-300 leading-relaxed mb-4">
                  {bet.is_fallback && bet.fallback_type === 'tier_min_fill'
                    ? `Fallback pick (not +EV): ${bet.fallback_reason || 'Insufficient +EV bets to meet minimum tier count.'}`
                    : bet.prob_source === 'market_fallback'
                      ? `Fair prob fallback to market (DG missing). ${bet.ai_analysis_paragraph || ''}`
                      : bet.ai_analysis_paragraph}
                </p>
                {bet.ai_analysis_bullets?.length > 0 && (
                  <ul className="space-y-2">
                    {bet.ai_analysis_bullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-400">
                        <span className="text-emerald-400 mt-1">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-slate-700/50">
          <Button
            variant="outline"
            className={`flex-1 ${isAdded ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}`}
            onClick={() => onAddBet?.(bet)}
            disabled={isAdded}
          >
            {isAdded ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Added
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add Bet
              </>
            )}
          </Button>
          <Button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={() => {
              const link = bet.affiliate_link_override || bet.affiliate_link;
              if (link) window.open(link, '_blank');
            }}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View Bet
          </Button>
        </div>
      </div>
    </motion.div>
  );
}