import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { api } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Crown, Check, Zap, Star, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function Memberships() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await api.auth.me();
        setUser(userData);
      } catch (e) {
        // Not logged in
      }
    };
    loadUser();
  }, []);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['membershipPackages'],
    queryFn: () => base44.entities.MembershipPackage.filter({ enabled: true }, 'display_order', 50)
  });

  const { data: membershipsContent } = useQuery({
    queryKey: ['siteContent', 'memberships'],
    queryFn: () => api.siteContent.get('memberships'),
    retry: false
  });

  const heroTitle = membershipsContent?.json?.hero?.title || 'Premium Membership';
  const heroSubtitle = membershipsContent?.json?.hero?.subtitle || 'Unlock exclusive features and maximize your betting success';

  const { data: subscription } = useQuery({
    queryKey: ['mySubscription', user?.email],
    queryFn: () => base44.entities.MembershipSubscription.filter({ 
      user_email: user.email,
      status: 'active'
    }),
    enabled: !!user?.email
  });

  const activeSubscription = subscription?.[0];

  const handleSelectPlan = async (pkg) => {
    if (!user) {
      api.auth.redirectToLogin();
      return;
    }

    // Check if running in iframe
    if (window.self !== window.top) {
      alert('Checkout only works from published apps. Please open this app in a new tab.');
      return;
    }

    try {
      const response = await base44.functions.invoke('createCheckoutSession', {
        packageId: pkg.id,
        priceId: pkg.stripe_price_id,
        successUrl: window.location.origin + window.location.pathname + '?success=true',
        cancelUrl: window.location.origin + window.location.pathname + '?cancelled=true'
      });

      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
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

  if (isLoading) return <LoadingSpinner text="Loading packages..." />;

  return (
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
                {activeSubscription.package_name} • Renews {new Date(activeSubscription.next_payment_date).toLocaleDateString()}
              </p>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              {activeSubscription.status}
            </Badge>
          </div>
        </motion.div>
      )}

      {/* Packages Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packages.map((pkg, idx) => (
          <motion.div
            key={pkg.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`bg-slate-800/50 backdrop-blur-sm rounded-2xl border p-8 relative ${
              pkg.badges?.some(b => b.text.toLowerCase().includes('popular')) 
                ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/20' 
                : 'border-slate-700/50'
            }`}
          >
            {/* Badges */}
            {pkg.badges && pkg.badges.length > 0 && (
              <div className="flex gap-2 mb-4 flex-wrap">
                {pkg.badges.map((badge, bidx) => (
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
              onClick={() => handleSelectPlan(pkg)}
              disabled={activeSubscription?.package_id === pkg.id}
              className={`w-full ${
                pkg.badges?.some(b => b.text.toLowerCase().includes('popular'))
                  ? 'bg-emerald-500 hover:bg-emerald-600'
                  : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              {activeSubscription?.package_id === pkg.id ? (
                'Current Plan'
              ) : (
                <>
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-12 text-center text-slate-500 text-sm">
        <p>All prices in GBP. Cancel anytime. No hidden fees.</p>
      </div>
    </div>
  );
}