import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Lock, Crown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

/**
 * ContentGate - Wraps content that may require a subscription.
 *
 * Props:
 *   resourceType: 'page' | 'component' | 'api_endpoint'
 *   resourceId: e.g. 'eagle-bets', 'longshots', 'matchup-analysis'
 *   fallback: optional custom fallback component
 *   blur: if true, shows blurred content instead of completely hiding
 *   children: the gated content
 *
 * If no access rule exists for this resource, children render freely.
 * Admin users always see content.
 */
export function useAccessCheck(resourceType, resourceId) {
  const { data, isLoading } = useQuery({
    queryKey: ['accessCheck', resourceType, resourceId],
    queryFn: async () => {
      const response = await api.client.get(
        `/api/access-check?type=${encodeURIComponent(resourceType)}&id=${encodeURIComponent(resourceId)}`
      );
      return response;
    },
    enabled: !!resourceType && !!resourceId,
    staleTime: 60_000,
    retry: false
  });

  return {
    allowed: data?.allowed ?? true,
    requiredLevel: data?.required_level || 'free',
    userLevel: data?.user_level || 'free',
    isLoading
  };
}

export default function ContentGate({
  resourceType = 'page',
  resourceId,
  fallback,
  blur = false,
  children
}) {
  const navigate = useNavigate();
  const { allowed, requiredLevel, userLevel, isLoading } = useAccessCheck(resourceType, resourceId);

  // While loading or if no resourceId, show content
  if (isLoading || !resourceId) return <>{children}</>;

  // Access granted
  if (allowed) return <>{children}</>;

  // Custom fallback
  if (fallback) return <>{fallback}</>;

  const levelLabels = { free: 'Free', pro: 'Pro', elite: 'Elite' };
  const requiredLabel = levelLabels[requiredLevel] || requiredLevel;

  // Blur mode - show content with overlay
  if (blur) {
    return (
      <div className="relative">
        <div className="filter blur-md pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm rounded-xl">
          <div className="text-center p-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 mb-4">
              <Lock className="w-7 h-7 text-amber-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {requiredLabel} Content
            </h3>
            <p className="text-slate-400 mb-4">
              Upgrade to {requiredLabel} to unlock this content
            </p>
            <Button
              onClick={() => navigate('/Memberships')}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade Now
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Default: replace content with upgrade CTA
  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-8 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-600/20 border border-amber-500/30 mb-4">
        <Lock className="w-8 h-8 text-amber-400" />
      </div>
      <h3 className="text-2xl font-bold text-white mb-2">
        {requiredLabel} Members Only
      </h3>
      <p className="text-slate-400 mb-6 max-w-md mx-auto">
        This content is available for {requiredLabel} members and above.
        {userLevel !== 'free' && ` You currently have ${levelLabels[userLevel] || userLevel} access.`}
      </p>
      <Button
        onClick={() => navigate('/Memberships')}
        className="bg-emerald-500 hover:bg-emerald-600 text-white"
        size="lg"
      >
        <Crown className="w-4 h-4 mr-2" />
        View Plans
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}
