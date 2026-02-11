import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useTrackedBets } from '@/hooks/useTrackedBets';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { motion } from 'framer-motion';
import { 
  Target, 
  Zap, 
  Trophy, 
  Sparkles,
  ArrowRight, 
  TrendingUp,
  Calendar,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import BetCard from '@/components/ui/BetCard';
import TourFilter from '@/components/ui/TourFilter';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import CmsBlocks from '@/components/CmsBlocks';

const categoryCards = [
  {
    id: 'par',
    label: 'Par Bets',
    description: '5/1 & Under',
    icon: Target,
    color: 'emerald',
    page: 'ParBets'
  },
  {
    id: 'birdie',
    label: 'Birdie Bets',
    description: '6/1 - 10/1',
    icon: Zap,
    color: 'amber',
    page: 'BirdieBets'
  },
  {
    id: 'eagle',
    label: 'Eagle Bets',
    description: '11/1+',
    icon: Trophy,
    color: 'violet',
    page: 'EagleBets'
  },
  {
    id: 'longshots',
    label: 'The Long Shots',
    description: '60/1+',
    icon: Sparkles,
    color: 'rose',
    page: 'LongShots'
  }
];

const colorClasses = {
  emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
  amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
  violet: 'from-violet-500/20 to-violet-600/10 border-violet-500/30 text-violet-400',
  rose: 'from-rose-500/20 to-rose-600/10 border-rose-500/30 text-rose-400'
};

export default function Home() {
  const [selectedTour, setSelectedTour] = useState('all');
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const authData = JSON.parse(localStorage.getItem('betcaddies_auth') || 'null');
        if (authData?.isLoggedIn && authData?.user) {
          setUser(authData.user);
        }
      } catch (e) {}
    };
    loadUser();
  }, []);

  const { data: bets = [], isLoading: betsLoading } = useQuery({
    queryKey: ['bets', 'latest'],
    queryFn: () => api.getLatestBets()
  });

  const { data: homeContent } = useQuery({
    queryKey: ['siteContent', 'home'],
    queryFn: () => api.siteContent.get('home'),
    retry: false
  });

  const { data: homePage } = useQuery({
    queryKey: ['cmsPage', 'home'],
    queryFn: () => api.pages.get('home'),
    retry: false
  });

  const homeBlocks = Array.isArray(homePage?.blocks) ? homePage.blocks : [];
  const heroBlock = homeBlocks.find((block) => block?.type === 'hero');
  const featureBlock = homeBlocks.find((block) => block?.type === 'feature_grid');
  const faqBlock = homeBlocks.find((block) => block?.type === 'faq');

  const heroTitleRaw = heroBlock?.data?.title || homeContent?.json?.hero?.title || 'Your Weekly Golf Picks';
  const heroSubtitle = heroBlock?.data?.subtitle || homeContent?.json?.hero?.subtitle || '30 curated bets across 5 tours. Data-driven selections with transparent analysis and real value.';
  const heroParts = String(heroTitleRaw).split('|');
  const heroTitlePlain = heroParts[0] || '';
  const heroTitleAccent = heroParts.length > 1 ? heroParts.slice(1).join('|') : null;

  const features = Array.isArray(featureBlock?.data?.items)
    ? featureBlock.data.items
    : (Array.isArray(homeContent?.json?.features) ? homeContent.json.features : []);
  const faqs = Array.isArray(faqBlock?.data?.items)
    ? faqBlock.data.items
    : (Array.isArray(homeContent?.json?.faqs) ? homeContent.json.faqs : []);

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => Promise.resolve([]) // Mock for now
  });

  const { isTracked, toggleTrack } = useTrackedBets();

  const filteredBets = bets.filter(bet =>
    selectedTour === 'all' || bet.tourEvent?.tour === selectedTour
  );

  const categoryCounts = {
    par: filteredBets.filter(b => b.tier === 'PAR').length,
    birdie: filteredBets.filter(b => b.tier === 'BIRDIE').length,
    eagle: filteredBets.filter(b => b.tier === 'EAGLE').length,
    longshots: filteredBets.filter(b => (b.odds_decimal_best || b.bestOdds || 0) >= 61).length
  };

  const featuredBets = filteredBets.slice(0, 6);

  const currentWeek = bets[0]?.run_id?.replace('weekly_', '') || 'This Week';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
          <Calendar className="w-4 h-4" />
          <span>Week of {currentWeek}</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
          {heroTitleAccent ? (
            <>
              {heroTitlePlain}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">{heroTitleAccent}</span>
            </>
          ) : (
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">{heroTitlePlain}</span>
          )}
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl">
          {heroSubtitle}
        </p>
      </motion.div>

      {/* Tour Filter */}
      <div className="mb-8">
        <TourFilter selected={selectedTour} onChange={setSelectedTour} />
      </div>

      {/* Category Cards */}
      <div className="grid md:grid-cols-3 gap-4 mb-10">
        {categoryCards.map((cat, idx) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Link
              to={createPageUrl(cat.page)}
              className={`block relative overflow-hidden rounded-2xl border bg-gradient-to-br ${colorClasses[cat.color]} p-6 hover:scale-[1.02] transition-transform`}
            >
              <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <cat.icon className="w-8 h-8" />
                  <span className="text-3xl font-bold">{categoryCounts[cat.id]}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-1">{cat.label}</h3>
                <p className="text-sm opacity-70">{cat.description}</p>
                <div className="flex items-center gap-1 mt-4 text-sm">
                  <span>View all</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Featured Picks */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Featured Picks</h2>
            <p className="text-slate-400 text-sm mt-1">Top confidence selections this week</p>
          </div>
          <Link
            to={createPageUrl('ParBets')}
            className="text-emerald-400 hover:text-emerald-300 text-sm font-medium flex items-center gap-1"
          >
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {betsLoading ? (
          <LoadingSpinner text="Loading picks..." />
        ) : featuredBets.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No Active Picks"
            description="Check back soon for this week's curated selections."
          />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredBets.map((bet, idx) => (
              <motion.div
                key={bet.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <BetCard
                  bet={bet}
                  providers={providers}
                  isAdded={isTracked(bet.id)}
                  onAddBet={toggleTrack}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Stats Banner */}
      {bets.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-slate-800/50 to-slate-800/30 rounded-2xl border border-slate-700/50 p-6"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-3xl font-bold text-white">{bets.length}</div>
              <div className="text-slate-400 text-sm">Active Picks</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">5</div>
              <div className="text-slate-400 text-sm">Tours Covered</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-emerald-400">
                {bets.filter(b => b.confidence_rating >= 4).length}
              </div>
              <div className="text-slate-400 text-sm">High Confidence</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">
                {[...new Set(bets.map(b => b.tournament_name))].length}
              </div>
              <div className="text-slate-400 text-sm">Tournaments</div>
            </div>
          </div>
        </motion.div>
      )}

      {(features.length > 0 || faqs.length > 0) && (
        <div className="mt-10 space-y-10">
          {features.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">Why Bet Caddies</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {features.slice(0, 9).map((f, idx) => (
                  <div key={idx} className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
                    <div className="font-semibold text-white mb-1">{f.title || f.name || '—'}</div>
                    <div className="text-sm text-slate-400">{f.body || f.description || ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {faqs.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">FAQs</h2>
              <div className="space-y-3">
                {faqs.slice(0, 12).map((f, idx) => (
                  <div key={idx} className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
                    <div className="font-medium text-white">{f.q || f.question || '—'}</div>
                    <div className="text-sm text-slate-400 mt-2">{f.a || f.answer || ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {homeBlocks.length > 0 && (
        <div className="mt-10">
          <CmsBlocks blocks={homeBlocks} excludeTypes={['hero', 'feature_grid', 'faq']} />
        </div>
      )}

      {/* Responsible Gambling Notice */}
      <div className="mt-10 text-center">
        <p className="text-slate-500 text-xs">
          Please gamble responsibly. If you need support, visit{' '}
          <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
            BeGambleAware.org
          </a>
        </p>
      </div>
    </div>
  );
}