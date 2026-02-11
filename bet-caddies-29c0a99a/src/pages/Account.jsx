import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, CreditCard, Crown, FileText, AlertTriangle,
  Check, X, ArrowRight, LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function Account() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await api.auth.me();
        setUser(userData);
      } catch (e) {
        navigate('/');
      }
    };
    loadUser();
  }, [navigate]);

  const { data: subscription } = useQuery({
    queryKey: ['mySubscription'],
    queryFn: () => api.membershipSubscriptions.me(),
    enabled: !!user,
    retry: false
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['myInvoices'],
    queryFn: () => api.membershipSubscriptions.invoices(),
    enabled: !!user,
    retry: false
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.membershipSubscriptions.cancel(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mySubscription'] });
    }
  });

  const handleLogout = () => {
    api.auth.logout();
    navigate('/');
  };

  if (!user) return <LoadingSpinner text="Loading account..." />;

  const statusColors = {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    trialing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    past_due: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    paused: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
              <User className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">My Account</h1>
              <p className="text-slate-400">{user.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="border-slate-600">
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>

        {/* Subscription Card */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Subscription</h2>
          </div>

          {subscription ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium text-lg">{subscription.package_name}</div>
                  <div className="text-slate-400 text-sm">
                    £{subscription.price_paid}/{subscription.billing_period}
                    {subscription.access_level && ` • ${subscription.access_level.charAt(0).toUpperCase() + subscription.access_level.slice(1)} access`}
                  </div>
                </div>
                <Badge className={statusColors[subscription.status] || statusColors.active}>
                  {subscription.status}
                </Badge>
              </div>

              {subscription.next_payment_date && !subscription.cancel_at_period_end && (
                <p className="text-slate-400 text-sm">
                  Next payment: {new Date(subscription.next_payment_date).toLocaleDateString()}
                </p>
              )}

              {subscription.cancel_at_period_end && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-sm text-amber-300">
                    Subscription will end on {subscription.next_payment_date
                      ? new Date(subscription.next_payment_date).toLocaleDateString()
                      : 'the end of your billing period'
                    }
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/Memberships')}
                  className="border-slate-600"
                >
                  <ArrowRight className="w-4 h-4 mr-1" /> Change Plan
                </Button>
                {!subscription.cancel_at_period_end && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to cancel? You will retain access until the end of your billing period.')) {
                        cancelMutation.mutate();
                      }
                    }}
                    disabled={cancelMutation.isPending}
                    className="border-red-600/50 text-red-400 hover:bg-red-500/10"
                  >
                    {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Subscription'}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-slate-400 mb-4">No active subscription</p>
              <Button
                onClick={() => navigate('/Memberships')}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <Crown className="w-4 h-4 mr-2" /> View Plans
              </Button>
            </div>
          )}
        </div>

        {/* Billing History */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Billing History</h2>
          </div>

          {invoices.length === 0 ? (
            <p className="text-slate-500 text-sm">No invoices yet</p>
          ) : (
            <div className="space-y-2">
              {invoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0">
                  <div>
                    <span className="text-white text-sm">{inv.description || `Payment - ${inv.paymentProvider}`}</span>
                    <span className="text-slate-500 text-xs ml-2">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">
                      £{inv.amount?.toFixed(2)}
                    </span>
                    <Badge className={inv.status === 'paid'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-red-500/20 text-red-400 border-red-500/30'
                    }>
                      {inv.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
