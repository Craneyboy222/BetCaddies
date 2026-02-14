import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown, Check, Star, ArrowRight, CreditCard, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MembershipsSkeleton from '@/components/ui/skeletons/MembershipsSkeleton';
import SEOHead from '@/components/SEOHead';
import CmsBlocks from '@/components/CmsBlocks';

export default function Memberships() {
  const [user, setUser] = useState(null);
  const [billingToggle, setBillingToggle] = useState('monthly');
  const [selectedProvider, setSelectedProvider] = useState('stripe');
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await api.auth.me();
        setUser(userData);
      } catch (e) {}
    };
    loadUser();
  }, []);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['membershipPackages'],
    queryFn: () => api.membershipPackages.list(),
    retry: false
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['paymentProviders'],
    queryFn: () => api.paymentProviders.available(),
    retry: false
  });

  const { data: membershipsContent } = useQuery({
    queryKey: ['siteContent', 'memberships'],
    queryFn: () => api.siteContent.get('memberships'),
    retry: false
  });

  const { data: membershipsPage } = useQuery({
    queryKey: ['cmsPage', 'memberships'],
    queryFn: () => api.pages.get('memberships'),
    retry: false
  });

  const membershipBlocks = Array.isArray(membershipsPage?.blocks) ? membershipsPage.blocks : [];
  const membershipHero = membershipBlocks.find((block) => block?.type === 'hero');
  const heroTitle = membershipHero?.data?.title || membershipsContent?.json?.hero?.title || 'Premium Membership';
  const heroSubtitle = membershipHero?.data?.subtitle || membershipsContent?.json?.hero?.subtitle || 'Unlock exclusive features and maximize your betting success';

  const { data: activeSubscription } = useQuery({
    queryKey: ['mySubscription', user?.email],
    queryFn: () => api.membershipSubscriptions.me(),
    enabled: !!user?.email,
    retry: false
  });

  // Filter packages by selected billing period
  const filteredPackages = packages.filter(pkg =>
    pkg.billing_period === billingToggle || pkg.billing_period === 'lifetime'
  );

  // If no packages match the toggle, show all
  const displayPackages = filteredPackages.length > 0 ? filteredPackages : packages;

  const renewalDateText = (() => {
    const value = activeSubscription?.next_payment_date;
    if (!value) return null;
    const ts = Date.parse(value);
    if (!Number.isFinite(ts)) return null;
    try { return new Date(ts).toLocaleDateString(); } catch { return null; }
  })();

  const handleSelectPlan = async (pkg) => {
    if (!user) {
      navigate('/Join');
      return;
    }

    if (selectedProvider === 'stripe' && !pkg?.stripe_price_id) {
      alert('Checkout is not configured for this package yet.');
      return;
    }

    try {
      api.trackEvent('checkout_start', { packageId: pkg.id, packageName: pkg.name, provider: selectedProvider });
      const response = await api.membershipSubscriptions.checkout(pkg.id, selectedProvider);
      const url = response?.url;
      if (!url) throw new Error('Checkout session did not return a URL');
      window.location.href = url;
    } catch (error) {
      api.trackEvent('checkout_error', { packageId: pkg.id, error: error.message });
      alert(error.message || 'Failed to start checkout. Please try again.');
    }
  };

  const getBadgeColors = (color) => {
    const colors = {
      emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      rose: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
    };
    return colors[color] || colors.emerald;
  };

  const levelLabels = { free: 'Free', pro: 'Pro', elite: 'Elite' };

  if (isLoading) return <MembershipsSkeleton />;

  const hasMultipleBillingPeriods = packages.some(p => p.billing_period === 'monthly') &&
    packages.some(p => p.billing_period === 'yearly');

  return (
    <>
      <SEOHead title="Membership Plans" description="Unlock premium golf betting picks, detailed AI analysis, and exclusive features. Plans starting from just a few pounds per month." path="/Memberships" />
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-600/20 border border-amber-500/30 mb-4">
          <Crown className="w-8 h-8 text-amber-400" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">{heroTitle}</h1>
        <p className="text-xl text-slate-400">{heroSubtitle}</p>
      </motion.div>

      {membershipBlocks.length > 0 && (
        <div className="mb-12">
          <CmsBlocks blocks={membershipBlocks} excludeTypes={['hero']} />
        </div>
      )}

      {/* Billing Period Toggle */}
      {hasMultipleBillingPeriods && (
        <div className="flex justify-center mb-8">
          <div className="bg-slate-800/50 rounded-xl p-1 flex gap-1">
            <button
              onClick={() => setBillingToggle('monthly')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
                billingToggle === 'monthly'
                  ? 'bg-emerald-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingToggle('yearly')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1 ${
                billingToggle === 'yearly'
                  ? 'bg-emerald-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Yearly
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs ml-1">
                Save 20%
              </Badge>
            </button>
          </div>
        </div>
      )}

      {/* Active Subscription Banner */}
      {activeSubscription && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-5 h-5 text-emerald-400" />
                <span className="text-lg font-semibold text-white">Active Membership</span>
              </div>
              <p className="text-slate-300">
                {activeSubscription.package_name}
                {activeSubscription.access_level && ` (${levelLabels[activeSubscription.access_level] || activeSubscription.access_level})`}
                {renewalDateText ? ` • Renews ${renewalDateText}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                {activeSubscription.status}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/Account')}
                className="border-slate-600"
              >
                Manage
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Payment Provider Selector */}
      {providers.length > 1 && (
        <div className="flex justify-center gap-3 mb-8">
          {providers.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProvider(p.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
                selectedProvider === p.id
                  ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                  : 'bg-slate-800/30 border-slate-700/50 text-slate-400 hover:border-slate-600'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Packages Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayPackages.map((pkg, idx) => {
          const isPopular = pkg.popular || pkg.badges?.some(b => String(b?.text || '').toLowerCase().includes('popular'));
          const isCurrentPlan = activeSubscription?.package_id === pkg.id;

          return (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`bg-slate-800/50 backdrop-blur-sm rounded-2xl border p-8 relative ${
                isPopular
                  ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/20'
                  : 'border-slate-700/50'
              }`}
            >
              {/* Most Popular badge */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-emerald-500 text-white border-emerald-400 px-3 py-1">
                    <Zap className="w-3 h-3 mr-1" /> Most Popular
                  </Badge>
                </div>
              )}

              {/* Access Level Badge */}
              {pkg.access_level && pkg.access_level !== 'free' && (
                <Badge className={`mb-3 ${
                  pkg.access_level === 'elite'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}>
                  {levelLabels[pkg.access_level] || pkg.access_level} Access
                </Badge>
              )}

              {/* Custom Badges */}
              {pkg.badges && pkg.badges.length > 0 && (
                <div className="flex gap-2 mb-4 flex-wrap">
                  {pkg.badges.filter(b => !String(b?.text || '').toLowerCase().includes('popular')).map((badge, bidx) => (
                    <Badge key={bidx} className={getBadgeColors(badge.color)}>
                      {badge.text}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Package Name */}
              <h3 className="text-2xl font-bold text-white mb-2">{pkg.name}</h3>

              {/* Price */}
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

              {/* Description */}
              {pkg.description && (
                <p className="text-slate-400 mb-6">{pkg.description}</p>
              )}

              {/* Features */}
              {pkg.features && pkg.features.length > 0 && (
                <div className="space-y-3 mb-8">
                  {pkg.features.map((feature, fidx) => (
                    <div key={fidx} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-300">{feature}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* CTA Button */}
              <Button
                onClick={() => isCurrentPlan ? navigate('/Account') : handleSelectPlan(pkg)}
                disabled={false}
                className={`w-full ${
                  isCurrentPlan
                    ? 'bg-slate-700 hover:bg-slate-600'
                    : isPopular
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                {isCurrentPlan ? (
                  'Current Plan'
                ) : !pkg?.stripe_price_id && selectedProvider === 'stripe' ? (
                  'Coming Soon'
                ) : (
                  <>
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </motion.div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-12 text-center text-slate-500 text-sm">
        <p>All prices in GBP. Cancel anytime. No hidden fees.</p>
      </div>
    </div>
    </>
  );
}
